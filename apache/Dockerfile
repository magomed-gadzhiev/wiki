FROM httpd:2.4-alpine

# Установка необходимых пакетов для компиляции и Kerberos
RUN apk add --no-cache \
    krb5 \
    krb5-dev \
    gcc \
    make \
    apache2-dev \
    pkgconf \
    && rm -rf /var/cache/apk/*

# Компиляция mod_auth_kerb
RUN cd /tmp && \
    wget -q https://github.com/modauthgssapi/mod_auth_gssapi/releases/download/v1.6.3/mod_auth_gssapi-1.6.3.tar.gz && \
    tar -xzf mod_auth_gssapi-1.6.3.tar.gz && \
    cd mod_auth_gssapi-1.6.3 && \
    ./configure --with-apxs=/usr/local/apache2/bin/apxs --with-gssapi=/usr && \
    make && \
    make install && \
    cd / && \
    rm -rf /tmp/mod_auth_gssapi-*

# Установка krb5 для runtime
RUN apk del gcc make apache2-dev pkgconf && \
    apk add --no-cache krb5-libs

# Копирование конфигурации Apache
COPY httpd.conf /usr/local/apache2/conf/httpd.conf
COPY httpd-kerberos.conf /usr/local/apache2/conf/extra/httpd-kerberos.conf

# Создание директории для keytab
RUN mkdir -p /etc/krb5 && chmod 755 /etc/krb5

EXPOSE 80

CMD ["httpd", "-D", "FOREGROUND"]

