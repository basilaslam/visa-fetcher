# Use the official Node.js 20 image as the base image
FROM node:20-bullseye-slim

# Set the working directory inside the container
WORKDIR /app

# Install required libraries
RUN apt-get update && \
    apt-get install -yq gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget libgbm1


    # Install GraphicsMagick
RUN apt-get install -y graphicsmagick

# Install Ghostscript
RUN apt-get install -y ghostscript


# Copy the Times New Roman font file to the fonts directory in the Docker image
COPY fonts/times.ttf /usr/share/fonts/

# Update the font cache
RUN fc-cache -f -v

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies
RUN npm install --production

# Copy the rest of the project files to the working directory
COPY . .

# Expose the port your application listens on
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]
