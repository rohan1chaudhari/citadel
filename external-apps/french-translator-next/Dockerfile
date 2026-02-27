FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV PORT=4013
EXPOSE 4013
CMD ["npm", "run", "dev"]
