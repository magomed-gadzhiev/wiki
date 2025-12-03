# Generated manually

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('articles', '0013_group_system_permission_level_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='article',
            old_name='title',
            new_name='model_name',
        ),
        migrations.RenameField(
            model_name='articleversion',
            old_name='title',
            new_name='model_name',
        ),
    ]

