# Generated manually

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('articles', '0009_article_deleted_at_article_is_deleted'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ArticleAttachment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('file', models.FileField(upload_to='articles/attachments/', verbose_name='Файл')),
                ('filename', models.CharField(max_length=255, verbose_name='Имя файла')),
                ('file_size', models.BigIntegerField(verbose_name='Размер файла (байт)')),
                ('comment', models.TextField(blank=True, verbose_name='Комментарий')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True, verbose_name='Загружено')),
                ('article', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='articles.article', verbose_name='Статья')),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name='Загрузил')),
            ],
            options={
                'verbose_name': 'Вложение статьи',
                'verbose_name_plural': 'Вложения статей',
                'ordering': ['-uploaded_at'],
            },
        ),
        migrations.AddIndex(
            model_name='articleattachment',
            index=models.Index(fields=['article', '-uploaded_at'], name='articles_ar_article_7a8b2c_idx'),
        ),
    ]

