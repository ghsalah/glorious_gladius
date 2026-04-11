from fleet.models import Delivery, WarehouseDepot
import math

wh = WarehouseDepot.objects.first()
if not wh:
    print("No warehouse")
else:
    def dist(la, lo):
        return math.sqrt((la-wh.lat)**2 + (lo-wh.lng)**2)

    for d in Delivery.objects.all():
        d_val = dist(d.lat, d.lng)
        print(f"{d.id} | {d.recipient_name} | {d.lat}, {d.lng} | {d_val}")
