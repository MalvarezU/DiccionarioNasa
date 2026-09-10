#!/usr/bin/env python3
"""Migra los tests de rutas API hacia los mocks compartidos de src/test/."""
import re, sys, io

ROOT = "src"

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)

AUTH_MOCK_BLOCK = re.compile(
    r'vi\.mock\("@/lib/auth", \(\) => \(\{\n\s*requireAdmin: vi\.fn\(\),\n\s*\}\),?\s*\)\)\s*\n'
)
ADMIN_SESSION = re.compile(
    r'const adminSession\s*=\s*(?:\{[^}]*\}|.+?as never)\s*\n', re.S
)
ALLOW_FN = re.compile(
    r'function allow\(\) \{\n.*?\n\}\n', re.S
)
DENY_FN = re.compile(
    r'function deny\(\) \{\n.*?\n\}\n', re.S
)

def strip_auth_db_mocks(src, db_block):
    """Quita vi.mock auth/db, import de auth, adminSession, allow/deny."""
    # quitar vi.mock auth
    src, n1 = AUTH_MOCK_BLOCK.subn("", src)
    # quitar vi.mock db (bloque con llaves balanceadas)
    idx = src.find('vi.mock("@/lib/db"')
    if idx >= 0:
        depth = 0
        i = src.index("(", idx)
        j = i
        while j < len(src):
            if src[j] == "{":
                depth += 1
            elif src[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        # consumir hasta el ))\n final
        k = src.index(")", j)
        end = k + 2  # "))"
        while end < len(src) and src[end] == "\n":
            end += 1
        src = src[:idx] + src[end:]
    # quitar import requireAdmin
    src = src.replace('import { requireAdmin } from "@/lib/auth"\n', "")
    # quitar adminSession
    src, n3 = ADMIN_SESSION.subn("", src)
    # quitar allow/deny
    src, n4 = ALLOW_FN.subn("", src)
    src, n5 = DENY_FN.subn("", src)
    return src, (n1, n3, n4, n5)

DB_MOCK_BLOCK = re.compile(r'vi\.mock\("@/lib/db", \(\) => \(\{(?:(?!\n\}\)\);?).)*?\n\}\);?\s*\)\)\s*\n', re.S)

def replace_calls(src):
    src = src.replace("allow()", "allowAdmin()")
    src = src.replace("deny()", "denyAdmin()")
    return src

# ---------- migrate admin (requireAdmin + db) ----------
def migrate_admin_db(path):
    src = read(path)
    # remove auth+db mocks, adminSession, allow/deny
    src = re.sub(r'vi\.mock\("@/lib/auth", \(\) => \(\{\n\s*requireAdmin: vi\.fn\(\),\n\s*\}\)\)\n', "", src)
    src = DB_MOCK_BLOCK.sub("", src)
    src = src.replace('import { requireAdmin } from "@/lib/auth"\n', "")
    src = ADMIN_SESSION.sub("", src)
    src = ALLOW_FN.sub("", src)
    src = DENY_FN.sub("", src)
    src = replace_calls(src)
    # insert shared imports after the last "import ... from vitest" line OR after existing imports
    header = 'import { vi, describe, it, expect, beforeEach } from "vitest"\n\nimport { mockDb, mockAuth, allowAdmin, denyAdmin } from "@/test/mocks"\n\nvi.mock("@/lib/auth", () => mockAuth)\nvi.mock("@/lib/db", () => ({ db: mockDb }))\n'
    # remove the original vitest import line to avoid duplicate
    src = re.sub(r'import \{ vi, describe, it, expect, beforeEach \} from "vitest"\n', "", src, count=1)
    src = header + src
    # keep import { db } from "@/lib/db" and import { GET... } from "./route"
    write(path, src)

import os
def main():
    # admin + db
    admin_db = [
        "src/app/api/admin/words/route.test.ts",
        "src/app/api/admin/users/route.test.ts",
        "src/app/api/admin/users/[id]/route.test.ts",
        "src/app/api/admin/audit-logs/route.test.ts",
        "src/app/api/admin/stats/route.test.ts",
        "src/app/api/admin/import/route.test.ts",
        "src/app/api/admin/words/bulk-status/route.test.ts",
        "src/app/api/admin/words/[id]/route.test.ts",
    ]
    for p in admin_db:
        migrate_admin_db(p)
        print("migrated", p)

if __name__ == "__main__":
    main()
