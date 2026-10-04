FROM --platform=linux/amd64 nginx:1.28-alpine@sha256:0dcc88822d45581e65ae329f8be769762bf628d3b2bb7d2a077d4aa5c98b30e3

ARG VCS_REF=unknown
ARG VCS_SOURCE=ssh://lotbi-ncloud-ro/srv/git/repositories/lotbi-site.git
LABEL org.opencontainers.image.source="${VCS_SOURCE}" \
      org.opencontainers.image.revision="${VCS_REF}"

ENV PORT=10000

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/nginx

EXPOSE 10000
