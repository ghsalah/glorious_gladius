import sqlite3

conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()

# Get all fleet tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'fleet_%'")
tables = [r[0] for r in cur.fetchall()]

for t in tables:
    cur.execute(f"PRAGMA table_info({t})")
    cols = [c[1] for c in cur.fetchall()]
    for c in cols:
        # Check for empty strings in all columns
        cur.execute(f"SELECT rowid, {c} FROM {t} WHERE {c} = ''")
        bad_empty = cur.fetchall()
        if bad_empty:
            print(f"Table {t} Column {c} has EMPTY STRINGS at rowids: {[r[0] for r in bad_empty]}")
        
        # Check for strings that might be bad UUIDs (not 32 or 36 chars) in common ID columns
        if c == 'id' or c.endswith('_id'):
            cur.execute(f"SELECT rowid, {c} FROM {t} WHERE {c} IS NOT NULL AND {c} != ''")
            for rowid, val in cur.fetchall():
                if isinstance(val, str) and len(val) not in (32, 36):
                    print(f"Table {t} Column {c} has POTENTIALLY BAD UUID value at rowid {rowid}: {repr(val)}")

conn.close()
