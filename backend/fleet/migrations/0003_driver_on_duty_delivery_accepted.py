from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("fleet", "0002_warehouse_depot"),
    ]

    operations = [
        migrations.AddField(
            model_name="driver",
            name="on_duty",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="delivery",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "pending"),
                    ("accepted", "accepted"),
                    ("in_progress", "in_progress"),
                    ("completed", "completed"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
