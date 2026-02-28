FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV PORT=4016
EXPOSE 4016
CMD ["npm", "run", "start"]
