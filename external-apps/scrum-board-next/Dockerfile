FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV PORT=4015
EXPOSE 4015
CMD ["npm", "run", "start"]
