"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSessionUser, onAuthChange, signOut } from "@/models/auth";

export type NavTag = { subject: string; type_tag: string; count: number };

/** 좌측 사이드바 셸. 데스크톱 고정, 모바일은 오버레이. */
export default function AppShell({
  nav,
  children,
}: {
  nav: NavTag[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    getSessionUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  const subjects = new Map<string, NavTag[]>();
  for (const t of nav) {
    const list = subjects.get(t.subject) ?? [];
    list.push(t);
    subjects.set(t.subject, list);
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-4">
      <Link
        href="/"
        className="press mb-2 flex items-center gap-2 rounded-xl px-3 py-2"
        onClick={() => setOpen(false)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue text-lg font-bold text-white">
          계
        </span>
        <span className="text-lg font-bold tracking-tight">회계 문제은행</span>
      </Link>

      <Link
        href="/quiz"
        onClick={() => setOpen(false)}
        className={`press mb-4 rounded-xl px-4 py-3 text-center text-[15px] font-bold ${
          pathname === "/quiz"
            ? "bg-blue-dark text-white"
            : "bg-blue text-white hover:bg-blue-dark"
        }`}
      >
        바로 문제풀기
      </Link>

      <Link
        href="/wrong"
        onClick={() => setOpen(false)}
        className={`press mb-3 flex items-center justify-between rounded-xl px-4 py-2.5 text-[14px] font-bold ${
          pathname === "/wrong"
            ? "bg-blue-soft text-blue"
            : "bg-background text-sub hover:bg-blue-soft hover:text-blue"
        }`}
      >
        오답노트
        {!user && <span className="text-[11px] font-medium text-muted">로그인</span>}
      </Link>

      {[...subjects.entries()].map(([subject, list]) => (
        <SubjectGroup
          key={subject}
          subject={subject}
          list={list}
          pathname={pathname}
          onNavigate={() => setOpen(false)}
        />
      ))}

      <div className="mt-auto border-t border-line pt-3">
        {user ? (
          <div className="flex items-center justify-between px-3 py-1">
            <span className="truncate text-[12px] text-muted">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="shrink-0 text-[12px] font-semibold text-sub hover:text-red"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            href="/wrong"
            onClick={() => setOpen(false)}
            className="block px-3 py-1 text-[12px] text-muted hover:text-blue"
          >
            로그인하면 오답노트가 저장돼요
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-line bg-surface lg:block">
        {sidebar}
      </aside>

      {/* 모바일 헤더 + 오버레이 */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          aria-label="메뉴"
          onClick={() => setOpen(true)}
          className="press rounded-lg p-1.5 hover:bg-background"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link href="/" className="font-bold">회계 문제은행</Link>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="rise absolute inset-y-0 left-0 w-72 bg-surface shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-16 lg:px-10 lg:pt-8">
        {children}
      </main>
    </div>
  );
}

function SubjectGroup({
  subject,
  list,
  pathname,
  onNavigate,
}: {
  subject: string;
  list: NavTag[];
  pathname: string;
  onNavigate: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-semibold text-muted hover:bg-background"
      >
        {subject}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      >
        <ul className="overflow-hidden">
          {list.map((t) => {
            const href = `/${encodeURIComponent(subject)}/${encodeURIComponent(t.type_tag)}`;
            const active = pathname === href;
            return (
              <li key={t.type_tag}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={`press flex items-center justify-between rounded-lg px-3 py-2 text-[14px] ${
                    active
                      ? "bg-blue-soft font-bold text-blue"
                      : "text-sub hover:bg-background"
                  }`}
                >
                  {t.type_tag}
                  <span className={`text-xs ${active ? "text-blue" : "text-muted"}`}>
                    {t.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
