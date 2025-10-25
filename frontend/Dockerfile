# # Use Node.js image to build and run the React app
# FROM node:18

# # Set working directory inside container
# WORKDIR /app

# # Copy package.json and install dependencies
# COPY package*.json ./
# RUN npm install

# # Copy the rest of the app (src, public, etc.)
# COPY . .

# # Start the React dev server
# CMD ["npm", "build"]

# Build stage
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Serve stage
FROM node:18
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/build ./build
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
