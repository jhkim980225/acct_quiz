"""문서(.docx / .hwpx / .hwp) 에서 본문 텍스트와 이미지를 추출하는 모듈.

목적: 사용자가 워드(.docx)·신형 한글(.hwpx)·구형 한글(.hwp) 파일을 올리면, 본문을
순서대로 텍스트로 뽑고, 이미지가 있던 자리에는 `[[IMAGE_n]]` 마커를 넣어둔다.
이렇게 하면 뒤이어 LLM 이 블로그 글로 재구성할 때 이미지의 '적재적소' 위치를
마커로 유지할 수 있고, 마커를 실제 이미지 링크로 치환해 초안을 완성한다.

- .docx: python-docx 로 문단/이미지를 문서 순서대로 순회한다.
- .hwpx: OWPML(zip+xml) 구조를 직접 파싱한다(본문 section*.xml, 이미지 BinData/).
  실제 한글 파일마다 스키마 편차가 있어 best-effort 로 처리하며, 해석하지
  못한 이미지는 건너뛰되 텍스트는 최대한 보존한다.
- .hwp: 구형 한글 바이너리(HWP 5.0 = OLE 복합문서)를 olefile+zlib 로 직접
  파싱한다(BodyText/Section 레코드, 이미지 BinData/). 배포용(암호화) 문서는 미지원.

이미지는 bytes 로만 담아 반환한다. 실제 파일 저장은 save_images() 로 분리해
저장 위치(초안 폴더 등)를 호출측이 결정하게 한다.
"""

from __future__ import annotations

import contextlib
import re
import struct
import zipfile
import zlib
from dataclasses import dataclass, field
from pathlib import Path


class DocumentImportError(RuntimeError):
    """문서 추출 과정에서 발생하는 오류."""


# 확장자 → content-type 보조 매핑(파트명에서 확장자를 못 얻을 때 대비).
_CT_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/x-emf": "emf",
    "image/x-wmf": "wmf",
    "image/tiff": "tiff",
    "image/webp": "webp",
}

SUPPORTED_SUFFIXES = (".docx", ".hwpx", ".hwp")


@dataclass
class ExtractedImage:
    """문서에서 추출한 이미지 하나."""

    index: int          # 1-based 순번
    marker: str         # 본문에 삽입된 마커, 예: "[[IMAGE_1]]"
    filename: str       # 저장 시 파일명, 예: "img_1.png"
    data: bytes         # 이미지 바이트
    ext: str            # 확장자(점 없음), 예: "png"


@dataclass
class ExtractedDoc:
    """문서 추출 결과."""

    title: str | None                       # 추정 제목(첫 문단 등), 없으면 None
    text: str                               # [[IMAGE_n]] 마커가 포함된 본문 텍스트
    images: list[ExtractedImage] = field(default_factory=list)
    source_path: Path | None = None


def extract_document(path: str | Path) -> ExtractedDoc:
    """확장자에 따라 문서를 파싱해 ExtractedDoc 을 반환한다.

    Raises:
        DocumentImportError: 파일이 없거나 지원하지 않는 형식/파싱 실패.
    """
    p = Path(path)
    if not p.exists():
        raise DocumentImportError(f"파일을 찾을 수 없습니다: {p}")
    suffix = p.suffix.lower()
    if suffix == ".docx":
        return _extract_docx(p)
    if suffix == ".hwpx":
        return _extract_hwpx(p)
    if suffix == ".hwp":
        return _extract_hwp(p)
    raise DocumentImportError(
        f"지원하지 않는 형식입니다: {suffix} (지원: {', '.join(SUPPORTED_SUFFIXES)})"
    )


# ---------------------------------------------------------------------------
# .docx 추출 (python-docx)
# ---------------------------------------------------------------------------
def _extract_docx(p: Path) -> ExtractedDoc:
    try:
        import docx  # python-docx
        from docx.oxml.ns import qn
    except ImportError as exc:  # pragma: no cover - 의존성 안내
        raise DocumentImportError(
            "python-docx 가 필요합니다. `pip install python-docx` 후 다시 시도하세요."
        ) from exc

    try:
        document = docx.Document(str(p))
    except Exception as exc:
        raise DocumentImportError(f".docx 를 열지 못했습니다: {exc}") from exc

    images: list[ExtractedImage] = []
    counter = 0
    lines: list[str] = []

    W_P = qn("w:p")
    W_TBL = qn("w:tbl")
    W_T = qn("w:t")
    W_TAB = qn("w:tab")
    W_BR = qn("w:br")
    A_BLIP = qn("a:blip")
    R_EMBED = qn("r:embed")

    def _resolve_image(embed_id: str) -> ExtractedImage | None:
        nonlocal counter
        try:
            part = document.part.related_parts[embed_id]
        except KeyError:
            return None
        blob = part.blob
        # 확장자 결정: 파트명 우선, 없으면 content_type.
        partname = str(getattr(part, "partname", ""))
        ext = partname.rsplit(".", 1)[-1].lower() if "." in partname else ""
        if not ext:
            ext = _CT_EXT.get(getattr(part, "content_type", ""), "png")
        if ext == "jpeg":
            ext = "jpg"
        counter += 1
        marker = f"[[IMAGE_{counter}]]"
        return ExtractedImage(
            index=counter,
            marker=marker,
            filename=f"img_{counter}.{ext}",
            data=blob,
            ext=ext,
        )

    def _process_paragraph(para_el) -> str:
        """문단을 문서 순서대로 순회하며 텍스트/이미지 마커 문자열을 만든다."""
        buf: list[str] = []
        for el in para_el.iter():
            if el.tag == W_T:
                buf.append(el.text or "")
            elif el.tag == W_TAB:
                buf.append("\t")
            elif el.tag == W_BR:
                buf.append("\n")
            elif el.tag == A_BLIP:
                embed = el.get(R_EMBED)
                if embed:
                    img = _resolve_image(embed)
                    if img is not None:
                        images.append(img)
                        buf.append(f"\n\n{img.marker}\n\n")
        return "".join(buf)

    body = document.element.body
    for block in body.iterchildren():
        if block.tag == W_P:
            lines.append(_process_paragraph(block))
        elif block.tag == W_TBL:
            # 표: 셀 텍스트만 단순 추출(구조는 보존하지 않음).
            for cell_t in block.iter(W_T):
                if cell_t.text:
                    lines.append(cell_t.text)

    text = _normalize_text("\n".join(lines))
    title = _guess_title(text)
    return ExtractedDoc(title=title, text=text, images=images, source_path=p)


# ---------------------------------------------------------------------------
# .hwpx 추출 (OWPML: zip + xml) — best-effort
# ---------------------------------------------------------------------------
def _extract_hwpx(p: Path) -> ExtractedDoc:
    try:
        zf = zipfile.ZipFile(str(p))
    except zipfile.BadZipFile as exc:
        raise DocumentImportError(
            ".hwpx 를 열지 못했습니다(zip 형식 아님). 구형 .hwp 파일이면 확장자를 "
            ".hwp 로 두고 다시 시도하세요(별도 경로로 지원)."
        ) from exc

    with zf:
        names = zf.namelist()

        # 본문 섹션: Contents/section0.xml, section1.xml, ...
        section_names = sorted(
            n for n in names
            if re.search(r"(^|/)section\d+\.xml$", n, re.IGNORECASE)
        )
        if not section_names:
            raise DocumentImportError(
                ".hwpx 본문(section*.xml)을 찾지 못했습니다. 손상되었거나 지원 "
                "범위를 벗어난 파일일 수 있습니다."
            )

        # BinData 파일 맵: {소문자 stem: 압축 내부 경로}
        bindata: dict[str, str] = {}
        for n in names:
            m = re.search(r"(^|/)BinData/([^/]+)$", n, re.IGNORECASE)
            if m:
                fname = m.group(2)
                stem = fname.rsplit(".", 1)[0].lower()
                bindata[stem] = n
                bindata[fname.lower()] = n  # 전체 파일명으로도 조회 가능

        images: list[ExtractedImage] = []
        counter = 0
        lines: list[str] = []
        seen_refs: set[str] = set()

        def _resolve_bin(ref: str) -> ExtractedImage | None:
            nonlocal counter
            if not ref:
                return None
            key = ref.lower()
            path_in_zip = bindata.get(key)
            if path_in_zip is None:
                # ref 가 'image1' 인데 BinData 에 'bin0001.png' 처럼 다를 수 있어
                # 부분 매칭도 시도.
                for stem, full in bindata.items():
                    if key in stem or stem in key:
                        path_in_zip = full
                        break
            if path_in_zip is None:
                return None
            try:
                blob = zf.read(path_in_zip)
            except KeyError:
                return None
            ext = path_in_zip.rsplit(".", 1)[-1].lower() if "." in path_in_zip else "png"
            if ext == "jpeg":
                ext = "jpg"
            counter += 1
            marker = f"[[IMAGE_{counter}]]"
            return ExtractedImage(
                index=counter,
                marker=marker,
                filename=f"img_{counter}.{ext}",
                data=blob,
                ext=ext,
            )

        for sec in section_names:
            try:
                raw = zf.read(sec).decode("utf-8", errors="replace")
            except KeyError:
                continue
            lines.append(_parse_hwpx_section(raw, _resolve_bin, images, seen_refs))

    text = _normalize_text("\n".join(lines))
    title = _guess_title(text)
    return ExtractedDoc(title=title, text=text, images=images, source_path=p)


def _parse_hwpx_section(raw_xml, resolve_bin, images, seen_refs) -> str:
    """hwpx section XML 을 문서 순서대로 훑어 텍스트+이미지 마커를 만든다.

    네임스페이스 편차에 견고하도록 localname 기준으로 판단한다.
    - 텍스트: localname == 't' (hp:t)
    - 문단 경계: localname == 'p'
    - 이미지: 'binaryItemIDRef' 속성을 가진 요소(img/pic 등)
    """
    import xml.etree.ElementTree as ET

    def _local(tag: str) -> str:
        return tag.rsplit("}", 1)[-1].lower() if "}" in tag else tag.lower()

    try:
        root = ET.fromstring(raw_xml)
    except ET.ParseError:
        # XML 파싱 실패 시 태그를 제거한 러프 텍스트라도 반환.
        return re.sub(r"<[^>]+>", " ", raw_xml)

    buf: list[str] = []

    def _walk(el) -> None:
        local = _local(el.tag)
        # 이미지 참조: binaryItemIDRef(대소문자/네임스페이스 무시) 속성 탐색.
        ref = None
        for k, v in el.attrib.items():
            if _local(k) == "binaryitemidref":
                ref = v
                break
        if ref is not None:
            img = resolve_bin(ref)
            if img is not None:
                images.append(img)
                buf.append(f"\n\n{img.marker}\n\n")

        if local == "t":
            # hp:t 의 텍스트(직접 텍스트 + 자식 tail 포함).
            if el.text:
                buf.append(el.text)
            for child in el:
                if child.tail:
                    buf.append(child.tail)
        for child in el:
            _walk(child)
        if local == "p":
            buf.append("\n")

    _walk(root)
    return "".join(buf)


# ---------------------------------------------------------------------------
# .hwp 추출 (구형 한글 바이너리, HWP 5.0 = OLE 복합문서) — 실검증 완료(2026-07-07)
# ---------------------------------------------------------------------------
# HWP 5.0 은 OLE 복합문서다. 본문은 BodyText/Section{N} 스트림에 zlib(raw
# deflate) 로 압축된 '레코드' 열로 들어있고, 이미지는 BinData/BIN####.ext 스트림
# 에 (역시 압축되어) 저장된다. 레코드 헤더(4바이트)에서 tag/level/size 를 얻고,
# 본문 텍스트(tag 67)와 그림(tag 85, offset 71 의 UINT16 = BinData 참조 id)을
# 문서 순서대로 훑어 [[IMAGE_n]] 마커를 제자리에 끼운다.
HWPTAG_PARA_TEXT = 67
HWPTAG_SHAPE_COMPONENT_PICTURE = 85
_PIC_BINID_OFFSET = 71  # SHAPE_COMPONENT_PICTURE 페이로드 내 UINT16 BinData id 위치

# PARA_TEXT 안의 제어문자 중 '확장 컨트롤'은 8 WCHAR(16바이트)를 차지한다.
_HWP_INLINE_CTRL = frozenset({1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23})


def _hwp_keep_char(o: int) -> bool:
    """구형 hwp 표/개체 셀에서 새어나온 잡음 문자를 걸러내는 화이트리스트.

    한글/한자/ASCII/일반문장부호/원형숫자(①❶)/전각 등만 남긴다. 그 밖의
    Latin 확장·아랍·티베트 등 잡음 코드포인트는 버린다(LLM 재구성 품질 보호).
    """
    return (
        0x20 <= o <= 0x7E          # ASCII 인쇄가능
        or 0xA1 <= o <= 0xFF        # Latin-1 보충(·×÷ 등)
        or 0x2000 <= o <= 0x206F    # 일반 문장부호(– — ' ' " " …)
        or 0x2460 <= o <= 0x24FF    # 원형 영숫자 ①②③
        or 0x2600 <= o <= 0x27BF    # 기호·딩벳 ❶✓★
        or 0x3000 <= o <= 0x303F    # CJK 기호/문장부호 「」『』、。
        or 0x3130 <= o <= 0x318F    # 한글 호환 자모 ㄱㅎㅏ
        or 0x3200 <= o <= 0x33FF    # 원형/괄호 CJK, 단위 ㎡㈜
        or 0x4E00 <= o <= 0x9FFF    # CJK 통합 한자
        or 0xAC00 <= o <= 0xD7A3    # 한글 음절
        or 0xF900 <= o <= 0xFAFF    # CJK 호환 한자
        or 0xFF00 <= o <= 0xFFEF    # 전각 형태
    )


def _decode_hwp_text(payload: bytes) -> str:
    """PARA_TEXT 레코드 페이로드(UTF-16LE + 제어문자)를 일반 텍스트로 푼다."""
    n = len(payload) // 2
    if n == 0:
        return ""
    wchars = struct.unpack("<%dH" % n, payload[: n * 2])
    buf: list[str] = []
    j = 0
    while j < n:
        c = wchars[j]
        if c in _HWP_INLINE_CTRL:
            j += 8  # 확장 컨트롤: 8 WCHAR 통째로 건너뜀
            continue
        if c == 9:
            buf.append("\t")
        elif c in (10, 13):
            buf.append("\n")
        elif c >= 32 and _hwp_keep_char(c):
            buf.append(chr(c))
        # 그 밖의 제어문자/잡음은 무시
        j += 1
    return "".join(buf)


def _iter_hwp_records(dec: bytes):
    """압축 해제된 섹션 바이트에서 (tag, level, payload) 레코드를 순서대로 yield."""
    i, L = 0, len(dec)
    while i + 4 <= L:
        header = struct.unpack("<I", dec[i : i + 4])[0]
        i += 4
        tag = header & 0x3FF
        level = (header >> 10) & 0x3FF
        size = (header >> 20) & 0xFFF
        if size == 0xFFF:  # 확장 크기: 다음 UINT32 가 실제 크기
            if i + 4 > L:
                break
            size = struct.unpack("<I", dec[i : i + 4])[0]
            i += 4
        payload = dec[i : i + size]
        i += size
        yield tag, level, payload


def parse_hwp_section(dec: bytes, on_text, on_picture) -> None:
    """섹션 레코드를 훑어 본문 텍스트는 on_text(str), 그림은 on_picture(bin_id)로 전달.

    OLE/파일 의존이 없는 순수 함수라 단위 테스트가 쉽다.
    """
    for tag, _level, payload in _iter_hwp_records(dec):
        if tag == HWPTAG_PARA_TEXT:
            on_text(_decode_hwp_text(payload))
        elif tag == HWPTAG_SHAPE_COMPONENT_PICTURE:
            if len(payload) >= _PIC_BINID_OFFSET + 2:
                bin_id = struct.unpack(
                    "<H", payload[_PIC_BINID_OFFSET : _PIC_BINID_OFFSET + 2]
                )[0]
                on_picture(bin_id)


def _maybe_inflate(data: bytes, compressed: bool) -> bytes:
    """압축 플래그가 서면 raw deflate 로 푼다(실패 시 원본 그대로)."""
    if not compressed:
        return data
    try:
        return zlib.decompress(data, -15)
    except zlib.error:
        return data


def _extract_hwp(p: Path) -> ExtractedDoc:
    try:
        import olefile
    except ImportError as exc:  # pragma: no cover - 의존성 안내
        raise DocumentImportError(
            "구형 .hwp 를 읽으려면 olefile 이 필요합니다. `pip install olefile` "
            "후 다시 시도하세요."
        ) from exc

    if not olefile.isOleFile(str(p)):
        raise DocumentImportError(
            ".hwp 형식이 아닙니다(OLE 복합문서 아님). 신형은 .hwpx 로 저장해 주세요."
        )
    try:
        ole = olefile.OleFileIO(str(p))
    except Exception as exc:
        raise DocumentImportError(f".hwp 를 열지 못했습니다: {exc}") from exc

    with contextlib.closing(ole):
        try:
            fh = ole.openstream("FileHeader").read()
        except OSError as exc:
            raise DocumentImportError(
                "손상되었거나 지원 범위를 벗어난 .hwp 입니다(FileHeader 없음)."
            ) from exc
        compressed = bool(struct.unpack("<I", fh[36:40])[0] & 0x01)

        # BinData 맵: {정수 id: (스트림경로, 확장자)}  이름 예: BIN0001.gif → id 1
        binmap: dict[int, tuple[str, str]] = {}
        entries = ole.listdir()
        for entry in entries:
            if len(entry) >= 2 and entry[0] == "BinData":
                fname = entry[-1]
                stem, _, ext = fname.partition(".")
                hexid = stem[3:] if stem.upper().startswith("BIN") else stem
                try:
                    bid = int(hexid, 16)
                except ValueError:
                    continue
                ext = ext.lower() or "bin"
                if ext == "jpeg":
                    ext = "jpg"
                binmap[bid] = ("/".join(entry), ext)

        # 본문 섹션: BodyText/Section0, Section1, ...
        sections = sorted(
            (e for e in entries
             if len(e) >= 2 and e[0] == "BodyText"
             and re.fullmatch(r"Section\d+", e[-1], re.IGNORECASE)),
            key=lambda e: int(re.search(r"\d+", e[-1]).group()),
        )
        if not sections:
            # 배포용 문서는 ViewText(암호화)에 본문이 들어가 파싱 불가.
            has_viewtext = any(e[0] == "ViewText" for e in entries if e)
            if has_viewtext:
                raise DocumentImportError(
                    "배포용(암호화) .hwp 는 지원하지 않습니다. 원본 한글에서 일반 "
                    "저장 또는 .hwpx 로 저장해 주세요."
                )
            raise DocumentImportError(
                ".hwp 본문(BodyText/Section)을 찾지 못했습니다."
            )

        images: list[ExtractedImage] = []
        parts: list[str] = []
        counter = 0

        def on_text(t: str) -> None:
            parts.append(t)

        def on_picture(bin_id: int) -> None:
            nonlocal counter
            info = binmap.get(bin_id)
            if info is None:
                return
            streampath, ext = info
            try:
                raw = ole.openstream(streampath).read()
            except OSError:
                return
            data = _maybe_inflate(raw, compressed)
            counter += 1
            marker = f"[[IMAGE_{counter}]]"
            images.append(
                ExtractedImage(
                    index=counter,
                    marker=marker,
                    filename=f"img_{counter}.{ext}",
                    data=data,
                    ext=ext,
                )
            )
            parts.append(f"\n\n{marker}\n\n")

        for entry in sections:
            try:
                raw = ole.openstream("/".join(entry)).read()
            except OSError:
                continue
            dec = _maybe_inflate(raw, compressed)
            parse_hwp_section(dec, on_text, on_picture)
            parts.append("\n")

    text = _normalize_text("\n".join(parts))
    title = _guess_title(text)
    return ExtractedDoc(title=title, text=text, images=images, source_path=p)


# ---------------------------------------------------------------------------
# 공통 유틸
# ---------------------------------------------------------------------------
def _normalize_text(text: str) -> str:
    """과도한 공백/빈 줄을 정리한다."""
    # 각 줄 오른쪽 공백 제거.
    lines = [ln.rstrip() for ln in text.replace("\r\n", "\n").split("\n")]
    lines = _strip_cbt_blocks(lines)
    out = "\n".join(lines)
    # 3줄 이상 빈 줄 → 2줄로.
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


# comcbt HWP 추출물에는 각 페이지 하단에 CBT 홍보 푸터 + OMR 정답표(문항번호/정답
# 기호만 나열)가 본문 중간중간 끼어든다. 본문엔 이미 ✅로 정답이 표시되므로 이 블록은
# 중복 잡음이라 제거한다. 블록은 '전자문제집 CBT 홈페이지'로 시작해, 이후 푸터 문구 /
# 순수 숫자 / 순수 정답기호 줄이 이어지다 첫 실제 콘텐츠 줄에서 끝난다.
_CBT_FOOTER_PREFIX = (
    "전자문제집 CBT 홈페이지",
    "기출문제 및 해설집 다운로드",
    "전자문제집 CBT 앱",
    "전자문제집 CBT란",
    "전자문제집 CBT",              # "전자문제집 CBT 에서 확인하세요" 변형
    "종이 문제집이 아닌",
    "무료 기출문제 학습",          # "...학습 프로그램으로" 변형(줄 분리됨)
    "실제 시험에서 사용하는 OMR",
    "OMR 형식의 CBT",
    "최신 수정된",                # "최신 수정된(오타,오답...)자료와 해설은" 변형
    "PC 버전 및 모바일 버전 완벽 연동",
    "교사용/학생용 관리기능도 제공",
    "오답 및 오탈자가 수정된",
)
_CBT_ANSWER_GLYPHS = {"①", "②", "③", "④", "⑤"}


def _is_cbt_junk_line(s: str) -> bool:
    t = s.strip()
    if any(t.startswith(p) for p in _CBT_FOOTER_PREFIX):
        return True
    return t.isdigit() or t in _CBT_ANSWER_GLYPHS


def _is_cbt_footer_start(s: str) -> bool:
    # 푸터 문구는 판(HWP)마다 순서/구성이 달라 '홈페이지'가 없을 때도 있다
    # (예: '전자문제집 CBT 앱...'으로 시작). 어떤 푸터 문구로 시작하든 블록을 연다.
    t = s.strip()
    return any(t.startswith(p) for p in _CBT_FOOTER_PREFIX)


def _strip_cbt_blocks(lines: list[str]) -> list[str]:
    out: list[str] = []
    i = 0
    while i < len(lines):
        if _is_cbt_footer_start(lines[i]):
            i += 1
            # 푸터 뒤 OMR 그리드(문항번호/정답기호)는 줄 사이 빈 줄로 떨어져 있을 수
            # 있다. 빈 줄도 넘기며 첫 실제 콘텐츠 줄 전까지 잡음을 모두 제거한다.
            while i < len(lines) and (_is_cbt_junk_line(lines[i]) or not lines[i].strip()):
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return out


def _guess_title(text: str) -> str | None:
    """본문 첫 비어있지 않은(마커 아닌) 줄을 제목 후보로 본다."""
    for line in text.split("\n"):
        s = line.strip()
        if s and not s.startswith("[[IMAGE_"):
            return s[:120]
    return None


def save_images(images: list[ExtractedImage], dest_dir: str | Path) -> dict[int, Path]:
    """추출 이미지들을 dest_dir 에 저장하고 {index: 저장경로} 를 반환한다."""
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    saved: dict[int, Path] = {}
    for img in images:
        target = dest / img.filename
        target.write_bytes(img.data)
        saved[img.index] = target
    return saved


def embed_image_links(
    body_markdown: str,
    images: list[ExtractedImage],
    path_map: dict[int, Path],
    base_dir: str | Path | None = None,
    append_missing: bool = True,
) -> str:
    """본문의 [[IMAGE_n]] 마커를 마크다운 이미지 링크로 치환한다.

    Args:
        body_markdown: 마커가 포함된 본문.
        images: 추출된 이미지 목록.
        path_map: {index: 저장 경로}.
        base_dir: 상대경로 기준 폴더(예: 초안 저장 폴더). 주면 상대경로로,
            없으면 저장된 절대경로로 링크한다.
        append_missing: LLM 이 누락한 마커가 있으면 본문 끝에 이미지들을 덧붙인다.

    Returns:
        마커가 이미지 링크로 치환된 본문.
    """
    base = Path(base_dir) if base_dir is not None else None
    result = body_markdown
    used: set[int] = set()

    for img in images:
        path = path_map.get(img.index)
        if path is None:
            continue
        link_target = _rel_or_abs(path, base)
        md = f"![{_alt_text(img)}]({link_target})"
        if img.marker in result:
            result = result.replace(img.marker, md)
            used.add(img.index)

    # 혹시 남은 (치환 안 된) 마커 제거 후, 누락 이미지 뒤에 덧붙이기.
    leftover_markers = re.findall(r"\[\[IMAGE_\d+\]\]", result)
    for m in leftover_markers:
        result = result.replace(m, "")

    if append_missing:
        missing = [img for img in images if img.index not in used and img.index in path_map]
        if missing:
            parts = [result.rstrip(), ""]
            for img in missing:
                link_target = _rel_or_abs(path_map[img.index], base)
                parts.append(f"![{_alt_text(img)}]({link_target})")
            result = "\n".join(parts)

    return _normalize_text(result)


def _alt_text(img: ExtractedImage) -> str:
    return f"이미지 {img.index}"


def _rel_or_abs(path: Path, base: Path | None) -> str:
    """base 기준 상대경로(슬래시)로, 불가하면 절대경로(슬래시)로 반환."""
    if base is not None:
        try:
            rel = path.relative_to(base)
            return rel.as_posix()
        except ValueError:
            pass
    return path.as_posix()
