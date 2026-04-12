import os
import django
import uuid

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from fleet.models import Delivery, Driver

print("Checking Drivers...")
for d in Driver.objects.all():
    try:
        # Accessing the ID triggers conversion if it's deferred or being used
        uid = d.id
    except Exception as e:
        print(f"FAILED on Driver with rowid? {d.pk}: {e}")

print("Checking Deliveries...")
# We use .values() or .iterator() to see when it fails
try:
    for d in Delivery.objects.all():
        try:
            # Just print the PK to see where we are
            pk = d.pk
            driver_id = d.assigned_driver_id
        except Exception as e:
            print(f"FAILED on a delivery record: {e}")
            # We need to find WHICH row it is.
            # Since .all() fails, we might need to use raw sqlite to find the row.
            break
except Exception as e:
    print(f"Outer loop failure: {e}")
