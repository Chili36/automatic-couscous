import './style.css'
import axios from 'axios'

// API client
const api = axios.create({
  baseURL: '/api'
})

// App state
let currentResults = []

// Initialize app
function initApp() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="container">
      <header>
        <h1>FoodEx2 Code Validator</h1>
        <p class="subtitle">Validate FoodEx2 codes against MTX catalogue v16.2</p>
      </header>

      <main>
        <section class="input-section">
          <div class="tabs">
            <button class="tab active" data-tab="single">Single Validation</button>
            <button class="tab" data-tab="batch">Batch Validation</button>
          </div>

          <div class="tab-content active" id="single-tab">
            <div class="input-group">
              <label for="single-code">Enter FoodEx2 Code</label>
              <input 
                type="text" 
                id="single-code" 
                placeholder="e.g., A0B9Z#F28.A07JS"
                autocomplete="off"
              >
              <button class="btn-primary" id="validate-single">Validate</button>
            </div>
          </div>

          <div class="tab-content" id="batch-tab">
            <div class="input-group">
              <label for="batch-codes">Enter Codes (one per line)</label>
              <textarea 
                id="batch-codes" 
                rows="6"
                placeholder="A0B9Z\nA0EZS\nA0BXM#F28.A07JS"
              ></textarea>
              <button class="btn-primary" id="validate-batch">Validate All</button>
            </div>
          </div>

          <div class="examples">
            <h3>Quick Examples</h3>
            <div class="example-codes">
              <button class="example-code" data-code="A0B9Z">A0B9Z (Bovine meat)</button>
              <button class="example-code" data-code="A0EZS">A0EZS (Chicken meat)</button>
              <button class="example-code" data-code="A0BXM">A0BXM (Milk)</button>
              <button class="example-code" data-code="A000J">A000J (Cereal grains)</button>
              <button class="example-code" data-code="A0B9Z#F28.A07JS">A0B9Z#F28.A07JS (Cooked beef)</button>
              <button class="example-code" data-code="A0BXM#F01.A0F6E">A0BXM#F01.A0F6E (Cow milk)</button>
            </div>
          </div>
        </section>

        <section id="results" class="results-section" style="display: none;">
          <h2>Validation Results</h2>
          <div id="results-content"></div>
        </section>
      </main>

      <footer>
        <p>Backend: <a href="http://localhost:5001/api/health" target="_blank">API Status</a> | 
           <a href="http://localhost:5001/api/rules" target="_blank">View Rules</a></p>
      </footer>
    </div>
  `

  setupEventListeners()
}

// Setup event listeners
function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab)
    })
  })

  // Validation buttons
  document.getElementById('validate-single').addEventListener('click', validateSingle)
  document.getElementById('validate-batch').addEventListener('click', validateBatch)

  // Example codes
  document.querySelectorAll('.example-code').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const code = e.target.dataset.code
      document.getElementById('single-code').value = code
      switchTab('single')
      validateSingle()
    })
  })

  // Enter key for single validation
  document.getElementById('single-code').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') validateSingle()
  })
}

// Switch tabs
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName)
  })
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `${tabName}-tab`)
  })
}

// Validate single code
async function validateSingle() {
  const code = document.getElementById('single-code').value.trim()
  if (!code) {
    showError('Please enter a code to validate')
    return
  }

  showLoading()
  
  try {
    const response = await api.post('/validate', { code })
    displayResults([response.data])
  } catch (error) {
    showError(error.response?.data?.error || error.message)
  }
}

// Validate batch
async function validateBatch() {
  const codesText = document.getElementById('batch-codes').value.trim()
  if (!codesText) {
    showError('Please enter codes to validate')
    return
  }

  const codes = codesText.split('\n').map(c => c.trim()).filter(c => c)
  
  showLoading()
  
  try {
    const response = await api.post('/validate/batch', { codes })
    displayResults(response.data)
  } catch (error) {
    showError(error.response?.data?.error || error.message)
  }
}

// Display results
function displayResults(results) {
  currentResults = results
  const resultsSection = document.getElementById('results')
  const content = document.getElementById('results-content')
  
  resultsSection.style.display = 'block'
  
  content.innerHTML = results.map((result, index) => `
    <div class="result-item ${(result.severity || 'none').toLowerCase()}">
      <div class="result-header">
        <h3 class="code">${result.code}</h3>
        <span class="level-badge ${(result.severity || 'none').toLowerCase()}">${result.severity || 'NONE'}</span>
      </div>
      
      ${result.baseTerm ? `
        <div class="term-info">
          <div class="info-row">
            <span class="label">Base Term:</span>
            <span>${result.baseTerm.code} - ${result.baseTerm.name}</span>
          </div>
          <div class="info-row">
            <span class="label">Type:</span>
            <span>${result.baseTerm.type}</span>
          </div>
          ${result.facets && result.facets.length > 0 ? `
            <div class="info-row">
              <span class="label">Facets:</span>
              <span>${result.facets.join(' | ')}</span>
            </div>
          ` : ''}
          ${result.interpretedDescription ? `
            <div class="info-row">
              <span class="label">Interpreted:</span>
              <span>${result.interpretedDescription}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      <div class="warnings">
        <h4>Validation Messages</h4>
        ${result.warnings.length > 0 ? result.warnings.map(w => `
          <div class="warning ${(w.severity || 'low').toLowerCase()}">
            <span class="warning-rule">${w.rule || 'VBA'}</span>
            <span class="warning-message">${w.message}</span>
            ${w.additionalInfo ? `<div class="warning-info">${w.additionalInfo}</div>` : ''}
          </div>
        `).join('') : '<div class="no-warnings">✓ No warnings</div>'}
      </div>
      
      <div class="result-footer">
        <span class="valid-indicator ${result.valid ? 'valid' : 'invalid'}">
          ${result.valid ? '✓ Valid' : '✗ Invalid'}
        </span>
      </div>
    </div>
  `).join('')
  
  // Smooth scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

// Show loading state
function showLoading() {
  const resultsSection = document.getElementById('results')
  resultsSection.style.display = 'block'
  document.getElementById('results-content').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Validating codes...</p>
    </div>
  `
}

// Show error
function showError(message) {
  const resultsSection = document.getElementById('results')
  resultsSection.style.display = 'block'
  document.getElementById('results-content').innerHTML = `
    <div class="error-message">
      <strong>Error:</strong> ${message}
    </div>
  `
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp)