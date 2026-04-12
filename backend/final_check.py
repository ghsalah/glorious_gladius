import sqlite3
import uuid

conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()

def check_uuid(table, col):
    cur.execute(f"SELECT rowid, {col} FROM {table}")
    for rowid, val in cur.fetchall():
        if val is None: continue
        try:
            uuid.UUID(val)
        except Exception:
            print(f"BAD UUID in {table}.{col} rowid {rowid}: {repr(val)}")

print("Checking fleet_delivery.id")
check_uuid("fleet_delivery", "id")
print("Checking fleet_delivery.assigned_driver_id")
check_uuid("fleet_delivery", "assigned_driver_id")
print("Checking fleet_driver.id")
check_uuid("fleet_driver", "id")
conn.close()
