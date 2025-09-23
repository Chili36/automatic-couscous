import './style.css'
import axios from 'axios'

// API client
const api = axios.create({
  baseURL: '/api'
})

// App state
let currentResults = []
let currentFilter = 'all'
let currentStatistics = null

// Term type descriptions
const termTypeDescriptions = {
  'r': 'Raw commodity (unprocessed food)',
  'd': 'Derivative (processed from raw)',
  'c': 'Composite/Aggregated (food group)',
  's': 'Simple composite (simple mixed food)',
  'f': 'Facet descriptor (not base term)',
  'g': 'Generic/Group term',
  'h': 'Hierarchy term',
  'n': 'Non-specific term'
}

// Get readable term type description
function getTermTypeDescription(type) {
  return termTypeDescriptions[type] || type
}

// Escape HTML to prevent rendering issues
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function categorizeResultWarnings(result) {
  const allWarnings = Array.isArray(result.warnings) ? result.warnings : []
  const hardWarnings = Array.isArray(result.hardWarnings)
    ? result.hardWarnings
    : allWarnings.filter(w => ['ERROR', 'HIGH'].includes((w.severity || '').toUpperCase()))
  const softWarnings = Array.isArray(result.softWarnings)
    ? result.softWarnings
    : allWarnings.filter(w => (w.severity || '').toUpperCase() === 'LOW')
  const infoWarnings = Array.isArray(result.infoWarnings)
    ? result.infoWarnings
    : allWarnings.filter(w => (w.severity || '').toUpperCase() === 'NONE')

  return { hardWarnings, softWarnings, infoWarnings }
}

function renderWarning(warning) {
  const severity = (warning.severity || 'low').toLowerCase()
  const ruleLabel = warning.rule || warning.type || 'RULE'
  return `
    <div class="warning ${severity}">
      <span class="warning-rule">${ruleLabel}</span>
      <span class="warning-message">${warning.message}</span>
      ${warning.additionalInfo ? `<div class="warning-info">${warning.additionalInfo}</div>` : ''}
    </div>
  `
}

function renderWarningGroup(title, warnings, emptyMessage, groupClass = '') {
  const baseClass = `warning-group ${groupClass}`.trim()

  if (!warnings || warnings.length === 0) {
    return `
      <div class="${baseClass} empty">
        <h5>${title}</h5>
        <div class="no-warnings">${emptyMessage}</div>
      </div>
    `
  }

  return `
    <div class="${baseClass}">
      <h5>${title}</h5>
      ${warnings.map(renderWarning).join('')}
    </div>
  `
}

function renderWarningsSection(result) {
  const { hardWarnings, softWarnings, infoWarnings } = categorizeResultWarnings(result)

  const sections = [
    renderWarningGroup('Critical issues', hardWarnings, '✓ No critical issues', 'critical'),
    renderWarningGroup('Soft rule warnings', softWarnings, 'No soft rule warnings', 'soft')
  ]

  if (infoWarnings.length > 0) {
    sections.push(renderWarningGroup('Informational messages', infoWarnings, '', 'info'))
  }

  return sections.join('')
}

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

          <div class="resources">
            <h3>FoodEx2 Resources</h3>
            <div class="resource-links">
              <a href="https://www.efsa.europa.eu/en/data/data-standardisation" target="_blank" rel="noopener noreferrer" class="resource-link">
                <span>📊</span> EFSA FoodEx2 Data Standardisation
              </a>
              <a href="https://github.com/openefsa/catalogue-browser/wiki" target="_blank" rel="noopener noreferrer" class="resource-link">
                <span>🔍</span> EFSA Catalogue Browser (GitHub)
              </a>
            </div>
          </div>
        </section>

        <section id="results" class="results-section" style="display: none;">
          <div class="results-header">
            <h2>Validation Results</h2>
            <div class="results-controls">
              <div class="filter-controls">
                <label for="result-filter">Filter:</label>
                <select id="result-filter" aria-label="Filter results">
                  <option value="all">Show All</option>
                  <option value="invalid">Invalid Only</option>
                  <option value="valid">Valid Only</option>
                  <option value="error">ERROR Severity</option>
                  <option value="high">HIGH Severity</option>
                  <option value="low">LOW Warnings</option>
                </select>
              </div>
              <div class="export-controls">
                <select id="export-format" aria-label="Select export format">
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel (.xlsx)</option>
                </select>
                <button class="btn-secondary" id="download-results" disabled title="Download validation results">
                  Download
                </button>
              </div>
            </div>
          </div>
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
  document.getElementById('download-results').addEventListener('click', downloadResults)

  // Filter dropdown
  document.getElementById('result-filter').addEventListener('change', (e) => {
    currentFilter = e.target.value
    applyFilter()
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
    displayResults(response.data.results, response.data.statistics)
  } catch (error) {
    showError(error.response?.data?.error || error.message)
  }
}

// Display results
function displayResults(results, statistics = null) {
  const safeResults = Array.isArray(results) ? results : []
  currentResults = safeResults
  currentStatistics = statistics
  currentFilter = 'all' // Reset filter when new results come in
  document.getElementById('result-filter').value = 'all'

  renderResults()
}

// Apply filter and re-render
function applyFilter() {
  renderResults()
}

// Get filtered results based on current filter
function getFilteredResults() {
  if (!currentResults || currentFilter === 'all') {
    return currentResults
  }

  return currentResults.filter(result => {
    switch (currentFilter) {
      case 'invalid':
        return !result.valid
      case 'valid':
        return result.valid
      case 'error':
        return result.warnings?.some(w => w.severity === 'ERROR')
      case 'high':
        return result.warnings?.some(w => w.severity === 'HIGH')
      case 'low':
        return result.warnings?.some(w => w.severity === 'LOW')
      default:
        return true
    }
  })
}

// Render results with current filter
function renderResults() {
  const resultsSection = document.getElementById('results')
  const content = document.getElementById('results-content')
  const filteredResults = getFilteredResults()

  resultsSection.style.display = 'block'

  // Update statistics for filtered view
  let displayStats = currentStatistics
  if (currentStatistics && currentFilter !== 'all') {
    const filteredValid = filteredResults.filter(r => r.valid).length
    const filteredInvalid = filteredResults.filter(r => !r.valid).length
    displayStats = {
      ...currentStatistics,
      showing: filteredResults.length,
      total: currentResults.length,
      valid: filteredValid,
      invalid: filteredInvalid
    }
  }

  const summaryHtml = displayStats ? `
    <div class="results-summary">
      ${displayStats.showing !== undefined && displayStats.showing < displayStats.total ? `
        <div class="summary-card filter-info">
          <span class="summary-label">Showing</span>
          <span class="summary-value">${displayStats.showing} of ${displayStats.total}</span>
        </div>
      ` : `
        <div class="summary-card">
          <span class="summary-label">Total Codes</span>
          <span class="summary-value">${displayStats.total}</span>
        </div>
      `}
      <div class="summary-card success">
        <span class="summary-label">Valid</span>
        <span class="summary-value">${displayStats.valid}</span>
      </div>
      <div class="summary-card warning">
        <span class="summary-label">Invalid</span>
        <span class="summary-value">${displayStats.invalid}</span>
      </div>
      <div class="summary-card error">
        <span class="summary-label">Errors</span>
        <span class="summary-value">${displayStats.errors || 0}</span>
      </div>
      <div class="summary-card high">
        <span class="summary-label">High Warnings</span>
        <span class="summary-value">${displayStats.highWarnings || 0}</span>
      </div>
      <div class="summary-card soft">
        <span class="summary-label">Soft Warnings</span>
        <span class="summary-value">${displayStats.softWarnings ?? 0}</span>
      </div>
      <div class="summary-card info">
        <span class="summary-label">Info Messages</span>
        <span class="summary-value">${displayStats.infoMessages ?? 0}</span>
      </div>
      ${displayStats.successRate ? `
        <div class="summary-card neutral">
          <span class="summary-label">Success Rate</span>
          <span class="summary-value">${displayStats.successRate}</span>
        </div>
      ` : ''}
    </div>
  ` : ''

  content.innerHTML = summaryHtml + filteredResults.map((result) => `
    <div class="result-item ${(result.severity || 'none').toLowerCase()}">
      <div class="result-header">
        <h3 class="code">${escapeHtml(result.code)}</h3>
        <span class="level-badge ${(result.severity || 'none').toLowerCase()}">${result.severity || 'NONE'}</span>
      </div>
      
      ${result.baseTerm ? `
        <div class="term-info">
          <div class="info-row">
            <span class="label">Base Term:</span>
            <span>${escapeHtml(result.baseTerm.code)} - ${escapeHtml(result.baseTerm.name)}</span>
          </div>
          <div class="info-row">
            <span class="label">Type:</span>
            <span title="${result.baseTerm.type}">${getTermTypeDescription(result.baseTerm.type)}</span>
          </div>
          ${result.facets && result.facets.length > 0 ? `
            <div class="info-row">
              <span class="label">Facets:</span>
              <span>${result.facets.map(f => escapeHtml(f)).join(' | ')}</span>
            </div>
          ` : ''}
          ${result.interpretedDescription ? `
            <div class="info-row">
              <span class="label">Interpreted:</span>
              <span>${escapeHtml(result.interpretedDescription)}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      <div class="warnings">
        <h4>Validation Messages</h4>
        ${renderWarningsSection(result)}
      </div>
      
      <div class="result-footer">
        <span class="valid-indicator ${result.valid ? 'valid' : 'invalid'}">
          ${result.valid ? '✓ Valid' : '✗ Invalid'}
        </span>
      </div>
    </div>
  `).join('')

  updateExportState()
  // Smooth scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function updateExportState() {
  const exportButton = document.getElementById('download-results')
  if (!exportButton) return
  exportButton.disabled = !currentResults || currentResults.length === 0
}

async function downloadResults() {
  if (!currentResults || currentResults.length === 0) {
    return
  }

  const formatSelector = document.getElementById('export-format')
  const format = formatSelector ? formatSelector.value : 'csv'
  const codes = currentResults.map(result => result.code).filter(Boolean)

  if (codes.length === 0) {
    alert('No codes available for export')
    return
  }

  try {
    const response = await api.post('/validate/export', { codes, format }, { responseType: 'blob' })
    const mimeType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv;charset=utf-8;'

    const blob = new Blob([response.data], { type: mimeType })
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = format === 'xlsx'
      ? 'foodex2-validation-results.xlsx'
      : 'foodex2-validation-results.csv'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error('Download failed', error)
    const message = error.response?.data?.error || error.message || 'Failed to download results'
    alert(message)
  }
}

// Show loading state
function showLoading() {
  const resultsSection = document.getElementById('results')
  resultsSection.style.display = 'block'
  currentResults = []
  updateExportState()
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
  currentResults = []
  updateExportState()
  document.getElementById('results-content').innerHTML = `
    <div class="error-message">
      <strong>Error:</strong> ${message}
    </div>
  `
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp)