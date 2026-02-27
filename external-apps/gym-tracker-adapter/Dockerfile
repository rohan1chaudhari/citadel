FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
ENV PORT=4012
ENV CITADEL_HOST=http://localhost:3000
EXPOSE 4012
CMD ["npm", "start"]
