---
layout: page
title: Showcase
description: Community-built apps for Citadel
---

<script setup>
import { ref, onMounted } from 'vue'

const apps = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const response = await fetch('/registry.json')
    if (!response.ok) throw new Error('Failed to load registry')
    apps.value = await response.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

function copyInstallCommand(appId) {
  const command = `citadel-app install https://github.com/rohan1chaudhari/citadel/tree/main/apps/${appId}`
  navigator.clipboard.writeText(command)
  
  // Show feedback
  const btn = document.getElementById(`btn-${appId}`)
  if (btn) {
    const original = btn.textContent
    btn.textContent = 'Copied!'
    btn.classList.add('copied')
    setTimeout(() => {
      btn.textContent = original
      btn.classList.remove('copied')
    }, 1500)
  }
}
</script>

# App Showcase

Discover apps built by the Citadel community. Each app runs locally on your machine with full data privacy.

<div v-if="loading" class="loading">
  Loading apps...
</div>

<div v-else-if="error" class="error">
  Error loading apps: {{ error }}
</div>

<div v-else class="app-grid">
  <div v-for="app in apps" :key="app.id" class="app-card">
    <div class="app-header">
      <h3 class="app-name">{{ app.name }}</h3>
      <span v-if="app.verified" class="verified-badge" title="Verified">✓</span>
    </div>
    
    <div class="app-screenshot" v-if="app.screenshot">
      <img :src="app.screenshot" :alt="`${app.name} screenshot`" />
    </div>
    <div class="app-screenshot placeholder" v-else>
      <span class="placeholder-text">{{ app.name[0] }}</span>
    </div>
    
    <p class="app-description">{{ app.description }}</p>
    
    <div class="app-meta">
      <span class="app-author">by {{ app.author }}</span>
      <span class="app-version">v{{ app.version }}</span>
    </div>
    
    <div class="app-actions">
      <button 
        :id="`btn-${app.id}`"
        class="install-btn"
        @click="copyInstallCommand(app.id)"
        title="Copy install command"
      >
        📋 Copy Install Command
      </button>
      <a 
        v-if="app.repository" 
        :href="app.repository" 
        target="_blank" 
        rel="noopener"
        class="repo-link"
      >
        View Source →
      </a>
    </div>
  </div>
</div>

## Submit Your App

Have you built a Citadel app? [Submit it to the registry](https://github.com/rohan1chaudhari/citadel/issues/new?title=App%20Submission:%20YOUR_APP_NAME&body=Describe%20your%20app%20and%20include%20the%20repository%20URL.) to be featured here.

## Installation

Install any app with the Citadel CLI:

```bash
# From the registry
citadel-app install REPO_URL

# Example
citadel-app install https://github.com/rohan1chaudhari/citadel/tree/main/apps/smart-notes
```

<style scoped>
.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.app-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 1.25rem;
  background: var(--vp-c-bg-soft);
  transition: box-shadow 0.2s, transform 0.2s;
}

.app-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.app-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.app-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.verified-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--vp-c-brand);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: bold;
}

.app-screenshot {
  aspect-ratio: 16 / 10;
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg);
  margin-bottom: 1rem;
}

.app-screenshot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-screenshot.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--vp-c-brand-soft) 0%, var(--vp-c-brand-darker) 100%);
}

.placeholder-text {
  font-size: 3rem;
  font-weight: bold;
  color: var(--vp-c-brand);
  opacity: 0.5;
}

.app-description {
  margin: 0 0 0.75rem 0;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.app-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: var(--vp-c-text-3);
  margin-bottom: 1rem;
}

.app-author {
  font-weight: 500;
}

.app-version {
  font-family: monospace;
  background: var(--vp-c-bg);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.app-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.install-btn {
  width: 100%;
  padding: 0.625rem 1rem;
  background: var(--vp-c-brand);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.install-btn:hover {
  background: var(--vp-c-brand-dark);
}

.install-btn.copied {
  background: var(--vp-c-green);
}

.repo-link {
  text-align: center;
  font-size: 0.875rem;
  color: var(--vp-c-brand);
  text-decoration: none;
}

.repo-link:hover {
  text-decoration: underline;
}

.loading, .error {
  text-align: center;
  padding: 3rem;
  color: var(--vp-c-text-2);
}

.error {
  color: var(--vp-c-danger);
}
</style>
