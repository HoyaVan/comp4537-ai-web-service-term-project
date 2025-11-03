# Use nginx to serve static files
FROM nginx:alpine

# Remove default nginx configuration
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy static files to both locations
# /usr/share/nginx/html for nginx to serve
# /app/build for DigitalOcean App Platform static site deployment
COPY public /usr/share/nginx/html
COPY public /app/build

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Verify files exist and nginx config is valid
RUN test -f /usr/share/nginx/html/index.html && \
    test -f /app/build/index.html && \
    nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
