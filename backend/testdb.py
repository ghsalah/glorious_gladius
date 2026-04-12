import sqlite3
import uuid

conn = sqlite3.connect('db.sqlite3')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cur.fetchall()

for t in tables:
    t_name = t['name']
    cur.execute(f"PRAGMA table_info({t_name})")
    cols = cur.fetchall()
    for c in cols:
        col_type = c['type'].lower()
        col_name = c['name'].lower()
        
        # Django UUID fields map to char(32) under the hood in older Django, but could be varying in SQLite.
        # Check any column named 'id' or ending in '_id' mapping to models that have UUID fields.
        if col_name == 'id' or col_name.endswith('_id'):
            try:
                for r in cur.execute(f"SELECT rowid, {c['name']} FROM {t_name}"):
                    val = r[c['name']]
                    if val is not None:
                        try:
                            # int fields are fine, but if it parses as int but fails UUID, we only care if it's supposed to be a UUID.
                            # fleet_delivery.id, fleet_driver.id are UUIDs.
                            # auth_user.id is int, so we skip auth_user.id
                            if t_name in ('fleet_driver', 'fleet_delivery') and col_name in ('id', 'assigned_driver_id'):
                                if type(val) == str:
                                    uuid.UUID(val)
                                else:
                                    # Might be bytes or int
                                    pass
                        except ValueError:
                            print(f"Bad UUID in {t_name}.{col_name} rowid {r['rowid']}: {repr(val)}")
            except Exception as e:
                pass
