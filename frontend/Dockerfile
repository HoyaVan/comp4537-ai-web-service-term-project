# Use nginx to serve static files
FROM nginx:alpine

# Remove default nginx configuration
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy static files from public directory to nginx html directory
COPY public /usr/share/nginx/html

# Also copy to /app/build for deployment platform
COPY public /app/build

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Verify nginx configuration
RUN nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
