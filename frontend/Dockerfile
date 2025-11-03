# Use nginx to serve static files
FROM nginx:alpine

# Copy static files from public directory
COPY public /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
