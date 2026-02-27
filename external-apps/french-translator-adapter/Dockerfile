FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
ENV PORT=4013
ENV CITADEL_HOST=http://localhost:3000
EXPOSE 4013
CMD ["npm", "start"]
