import sqlite3
conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()
cur.execute("SELECT id, recipient_name, status FROM fleet_delivery")
for row in cur.fetchall():
    print(row)
conn.close()
