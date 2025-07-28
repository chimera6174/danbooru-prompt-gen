    // Global variables
    let appTags = {};
    let allTags = [];
    let descriptionsAvailable = true;
    let backspaceTimer = null;
    let backspaceCount = 0;
    const categoriesDiv = document.getElementById("categories");
    const promptField = document.getElementById("promptField");
    const unifiedInput = document.getElementById("unifiedInput");
    const tagCount = document.getElementById("tagCount");
    const charCount = document.getElementById("charCount");
    const toast = document.getElementById("toast");
    const suggestionsDropdown = document.getElementById("suggestionsDropdown");
    const descriptionToggle = document.getElementById("descriptionToggle");
    const tagsFileInput = document.getElementById("tagsFileInput");
    
    // Initialize app
    function initApp() {
      // Load settings from localStorage
      const showDesc = localStorage.getItem('showDescriptions');
      if (showDesc !== null) {
        descriptionToggle.checked = showDesc === 'true';
      }
      
      // Load tags from localStorage if available
      const savedTags = localStorage.getItem('customTags');
      if (savedTags) {
        try {
          const parsed = JSON.parse(savedTags);
          appTags = parsed.data;
          descriptionsAvailable = parsed.format === 'json';
          renderCategories();
          toggleDescriptions(descriptionToggle.checked);
        } catch (e) {
          console.error("Error loading saved tags:", e);
        }
      }

    // Theme configuration
      const themeSelect = document.getElementById('themeSelect');
      const savedTheme = localStorage.getItem('theme') || 'sekiratte';
      setTheme(savedTheme);
      themeSelect.value = savedTheme;
      
      themeSelect.addEventListener('change', function() {
        setTheme(this.value);
      });
      
      // Accent color configuration
      const accentColorPicker = document.getElementById('accentColorPicker');
      const accentColorInput = document.getElementById('accentColorInput');
      
      // Set initial values
      const savedAccent = localStorage.getItem('accentColor');
      if (savedAccent) {
        setAccentColor(savedAccent);
        accentColorInput.value = savedAccent;
        accentColorPicker.value = savedAccent;
      } else {
        const currentAccent = getCurrentAccentHex();
        accentColorInput.placeholder = currentAccent;
      }
      
      accentColorPicker.addEventListener('input', function() {
        accentColorInput.value = this.value;
        setAccentColor(this.value);
      });
      
      accentColorInput.addEventListener('change', function() {
        let value = this.value.trim();
        if (value) {
          if (!value.startsWith('#')) value = '#' + value;
          if (value.length === 4) { // Expand short hex
            value = '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
          }
          if (value.match(/^#([0-9A-F]{6})$/i)) {
            accentColorPicker.value = value;
            setAccentColor(value);
          }
        } else {
          // Clear override
          document.documentElement.style.removeProperty('--accent');
          localStorage.removeItem('accentColor');
          accentColorInput.placeholder = getCurrentAccentHex();
        }
      });
      
      // Set up event listeners
      setupEventListeners();
      updateCounters();
    }


    function setTheme(themeName) {
      const themeLink = document.getElementById('theme-style');
      themeLink.href = `./src/css/themes/${themeName}.css`;
      localStorage.setItem('theme', themeName);
      
      // Update accent input placeholder
      setTimeout(() => {
        const currentAccent = getCurrentAccentHex();
        if (!localStorage.getItem('accentColor')) {
          document.getElementById('accentColorInput').placeholder = currentAccent;
        }
      }, 100);
    }

    function setAccentColor(color) {
      document.documentElement.style.setProperty('--accent', color);
      localStorage.setItem('accentColor', color);
    }
    
    // Set up event listeners
    function setupEventListeners() {
      // Description toggle
      descriptionToggle.addEventListener('change', function() {
        localStorage.setItem('showDescriptions', this.checked);
        toggleDescriptions(this.checked);
      });
      
      // File input handler
      tagsFileInput.addEventListener('change', handleFileUpload);
      
      // Unified search input
      unifiedInput.addEventListener('input', function() {
        showSuggestions(this.value);
      });
      
      unifiedInput.addEventListener('keydown', handleKeyDown);
      
      unifiedInput.addEventListener('focus', function() {
        if (this.value) showSuggestions(this.value);
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', function(e) {
        if (!unifiedInput.contains(e.target) && 
            !suggestionsDropdown.contains(e.target)) {
          suggestionsDropdown.style.display = 'none';
        }
      });
      
      // Hide dropdown on scroll/resize
      window.addEventListener('scroll', function() {
        suggestionsDropdown.style.display = 'none';
      });
      
      window.addEventListener('resize', function() {
        suggestionsDropdown.style.display = 'none';
      });
      
      promptField.addEventListener('input', updateCounters);
    }
    
    // Toggle description visibility
    function toggleDescriptions(show) {
      const descriptions = document.querySelectorAll('.description');
      descriptions.forEach(desc => {
        desc.style.display = show && descriptionsAvailable ? 'block' : 'none';
      });
      
      // Disable toggle if descriptions aren't available
      descriptionToggle.disabled = !descriptionsAvailable;
      if (!descriptionsAvailable) {
        descriptionToggle.checked = false;
      }
    }
    
    // Load default tags
    function loadDefaultTags() {
      fetch('../../data/default.json')
        .then(response => response.json())
        .then(data => {
          appTags = data;
          descriptionsAvailable = true;
          saveTagsToStorage('json');
          renderCategories();
          toggleDescriptions(descriptionToggle.checked);
          showToast('Default tags loaded');
        })
        .catch(error => {
          console.error('Error loading default tags:', error);
          showToast('Error loading tags', 'error');
        });
    }

    function loadDanbooruTags() {
      fetch('../../data/default.csv')
        .then(response => response.text())
        .then(text => {
          const lines = text.split('\n').filter(line => line.trim());
          const tags = lines.map(line => {
            const [tag, popularity] = line.split(',').map(item => item.trim());
            return { tag, popularity: parseInt(popularity) || 0 };
          })
          .sort((a, b) => b.popularity - a.popularity)
          .map(item => ({ tag: item.tag, desc: "" }));
          
          appTags = { "Danbooru Tags": tags };
          descriptionsAvailable = false;
          saveTagsToStorage('csv');
          renderCategories();
          toggleDescriptions(false);
          showToast('Danbooru tags loaded');
        })
        .catch(error => {
          console.error('Error loading Danbooru tags:', error);
          showToast('Error loading tags', 'error');
        });
    }
    
    // Handle file upload
    function handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      reader.onload = function(e) {
        try {
          if (fileExtension === 'json') {
            const jsonData = JSON.parse(e.target.result);
            appTags = jsonData;
            descriptionsAvailable = true;
            saveTagsToStorage('json');
            showToast('JSON tags loaded');
          } else if (fileExtension === 'txt' || fileExtension === 'csv') {
          const text = e.target.result;
          const lines = text.split('\n').filter(line => line.trim());
          let tags = [];
          
          if (fileExtension === 'csv') {
            // Parse CSV format: tag,popularity
            tags = lines.map(line => {
              const [tag, popularity] = line.split(',').map(item => item.trim());
              return { tag, popularity: parseInt(popularity) || 0 };
            })
            // Sort by popularity (descending)
            .sort((a, b) => b.popularity - a.popularity)
            .map(item => ({ tag: item.tag, desc: "" }));
          } else {
            // Handle TXT format
            tags = lines.map(tag => ({ tag: tag.trim(), desc: "" }));
          }
          
          appTags = { "Custom Tags": tags };
          descriptionsAvailable = false;
          saveTagsToStorage(fileExtension);
          showToast(`${fileExtension.toUpperCase()} tags loaded`);
          
          // Disable descriptions
          descriptionToggle.checked = false;
          localStorage.setItem('showDescriptions', 'false');
        } else {
          throw new Error('Unsupported file format');
        }
        
        renderCategories();
        toggleDescriptions(descriptionToggle.checked);
      } catch (error) {
        console.error('Error parsing file:', error);
        showToast('Error loading file', 'error');
      }
      
      event.target.value = '';
    };
      reader.readAsText(file);
    }
    
    // Save tags to localStorage
    function saveTagsToStorage(format) {
      localStorage.setItem('customTags', JSON.stringify({
        format: format,
        data: appTags
      }));
    }
    
    // Render categories
    function renderCategories() {
      categoriesDiv.innerHTML = '';
      
      // Rebuild allTags array
      allTags = [];
      for (const category in appTags) {
        allTags = [...allTags, ...appTags[category]];
      }
      
      // Render categories in chunks to avoid UI freeze
      const categories = Object.entries(appTags);
      let index = 0;
      
      function renderNextCategory() {
        if (index >= categories.length) return;
        
        const [cat, tags] = categories[index];
        const card = document.createElement('div'); 
        card.className = 'category-card';
        
        const header = document.createElement('div'); 
        header.className = 'category-header';
        header.innerHTML = `<h2><i class="fas fa-folder"></i> ${cat}</h2>`;
        card.appendChild(header);
        
        const section = document.createElement('div'); 
        section.className = 'tag-section';
        
        // Render tags in batches
        const batchSize = 100;
        let tagIndex = 0;
        
        function renderTagBatch() {
          const batchEnd = Math.min(tagIndex + batchSize, tags.length);
          
          for (; tagIndex < batchEnd; tagIndex++) {
            const {tag, desc} = tags[tagIndex];
            const cont = document.createElement('div'); 
            cont.className = 'tag-container';
            cont.onclick = () => addTagToPrompt(tag);
            
            const tagEl = document.createElement('div');
            tagEl.className = 'tag';
            tagEl.textContent = tag;
            cont.appendChild(tagEl);
            
            const descEl = document.createElement('div');
            descEl.className = 'description';
            descEl.textContent = desc;
            cont.appendChild(descEl);
            
            section.appendChild(cont);
          }
          
          if (tagIndex < tags.length) {
            setTimeout(renderTagBatch, 0);
          }
        }
        
        renderTagBatch();
        card.appendChild(section);
        categoriesDiv.appendChild(card);
        
        index++;
        setTimeout(renderNextCategory, 0);
      }
      
      renderNextCategory();
      
      // Apply description visibility
      toggleDescriptions(descriptionToggle.checked);
    }

    // Add tag to prompt
    function addTagToPrompt(tag) {
      let current = promptField.value.split(',').map(t => t.trim()).filter(t => t);
      if (!current.includes(tag)) {
        current.push(tag);
        promptField.value = current.join(', ');
        showToast(`${tag} added`);
        
        // Add visual feedback
        const tagEls = document.querySelectorAll('.tag-container');
        tagEls.forEach(el => {
          if (el.querySelector('.tag').textContent === tag) {
            el.classList.add('tag-highlight');
            setTimeout(() => el.classList.remove('tag-highlight'), 1500);
          }
        });
      }
      updateCounters();
    }

    function savePrompt() {
      const name = document.getElementById('promptNameInput').value.trim();
      const prompt = promptField.value.trim();
      
      if (!name) {
        showToast('Enter prompt name', 'error');
        return;
      }
      
      if (!prompt) {
        showToast('Prompt is empty', 'error');
        return;
      }
      
      // Get existing saves or create new object
      const savedPrompts = JSON.parse(localStorage.getItem('savedPrompts') || '{}');
      
      // Save new prompt
      savedPrompts[name] = prompt;
      localStorage.setItem('savedPrompts', JSON.stringify(savedPrompts));
      
      // Update UI
      document.getElementById('promptNameInput').value = '';
      populateSavedPromptsList();
      showToast(`"${name}" saved`);
    }

    function loadSavedPrompt(name) {
      if (!name) return;
      
      const savedPrompts = JSON.parse(localStorage.getItem('savedPrompts') || {});
      const prompt = savedPrompts[name];
      
      if (prompt) {
        promptField.value = prompt;
        updateCounters();
        showToast(`"${name}" loaded`);
      } else {
        showToast('Prompt not found', 'error');
      }
    }

    function deleteSavedPrompt(name) {
      if (!name) {
        showToast('Prompt name not provided', 'error');
        return;
      }
      
      const savedPrompts = JSON.parse(localStorage.getItem('savedPrompts') || {});
      if (savedPrompts[name]) {
        delete savedPrompts[name];
        localStorage.setItem('savedPrompts', JSON.stringify(savedPrompts));
        populateSavedPromptsList();
        showToast(`"${name}" deleted`);
      } else {
        showToast('Prompt not found', 'error');
      }
    }

    function populateSavedPromptsList() {
      const list = document.getElementById('savedPromptsList');
      list.innerHTML = '';
      
      const savedPrompts = JSON.parse(localStorage.getItem('savedPrompts') || {});
      
      Object.keys(savedPrompts).sort().forEach(name => {
        const item = document.createElement('div');
        item.className = 'saved-prompt-item';
        
        item.innerHTML = `
          <span class="prompt-name">${name}</span>
          <div class="prompt-actions">
            <button class="load-btn" onclick="loadSavedPrompt('${name}')">
              <i class="fas fa-download"></i> Load
            </button>
            <button class="copy-btn" onclick="copySavedPrompt('${name}')">
              <i class="fas fa-copy"></i> Copy
            </button>
            <button class="delete-btn" onclick="deleteSavedPrompt('${name}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;
        
        list.appendChild(item);
      });
    }

    function copySavedPrompt(name) {
      const savedPrompts = JSON.parse(localStorage.getItem('savedPrompts') || {});
      const prompt = savedPrompts[name];
      
      if (prompt) {
        navigator.clipboard.writeText(prompt).then(() => {
          showToast(`"${name}" copied to clipboard`);
        });
      }
    }

    // Handle unified add (custom tag or selected suggestion)
    function handleUnifiedAdd() {
      const tag = unifiedInput.value.trim();
      if (tag) {
        // Check if we have a highlighted suggestion
        if (currentSuggestionIndex >= 0) {
          const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
          if (items.length > currentSuggestionIndex) {
            const tagEl = items[currentSuggestionIndex].querySelector('.tag');
            if (tagEl) {
              addTagToPrompt(tagEl.textContent);
            }
          }
        } else {
          // Add as custom tag
          addTagToPrompt(tag);
        }
        unifiedInput.value = '';
        suggestionsDropdown.style.display = 'none';
        currentSuggestionIndex = -1;
      } else {
        showToast("Enter a tag", 'error');
      }
    }

    // Show suggestions based on input
    function showSuggestions(query) {
      suggestionsDropdown.innerHTML = '';
      currentSuggestionIndex = -1;
      
      if (query.length < 1) {
        suggestionsDropdown.style.display = 'none';
        return;
      }
      
      const filtered = allTags.filter(tagObj => 
        tagObj.tag.toLowerCase().includes(query.toLowerCase()) || 
        (tagObj.desc && tagObj.desc.toLowerCase().includes(query.toLowerCase()))
      );
      
      if (filtered.length === 0) {
        suggestionsDropdown.style.display = 'none';
        return;
      }
      
      // Create suggestion items
      filtered.forEach(({tag, desc}) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<div class="tag">${tag}</div><div class="description">${desc}</div>`;
        item.onclick = () => {
          addTagToPrompt(tag);
          unifiedInput.value = '';
          suggestionsDropdown.style.display = 'none';
          unifiedInput.focus();
        };
        suggestionsDropdown.appendChild(item);
      });
      
      suggestionsDropdown.style.display = 'block';
    }

    // Highlight suggestion item
    function highlightSuggestion(index) {
      const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
      items.forEach((item, i) => {
        item.classList.toggle('highlighted', i === index);
      });
      
      // Scroll into view if needed
      if (index >= 0 && items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
      }
    }

    // Handle keyboard events
    function handleKeyDown(e) {
      const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
      
      if (suggestionsDropdown.style.display === 'block' && items.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          currentSuggestionIndex = (currentSuggestionIndex + 1) % items.length;
          highlightSuggestion(currentSuggestionIndex);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          currentSuggestionIndex = (currentSuggestionIndex - 1 + items.length) % items.length;
          highlightSuggestion(currentSuggestionIndex);
        } else if (e.key === 'Tab' && currentSuggestionIndex >= 0) {
          e.preventDefault();
          const tagEl = items[currentSuggestionIndex].querySelector('.tag');
          if (tagEl) {
            unifiedInput.value = tagEl.textContent;
            // Move cursor to end
            unifiedInput.setSelectionRange(
              unifiedInput.value.length,
              unifiedInput.value.length
            );
          }
        } else if (e.key === 'Escape') {
          suggestionsDropdown.style.display = 'none';
          currentSuggestionIndex = -1;
        }
      }

      // Handle Enter key regardless of whether the dropdown is open
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUnifiedAdd();
      }
      if (e.key === 'Backspace' && unifiedInput.value === '') {
        e.preventDefault();
        
        // Reset counter if last backspace was more than 300ms ago
        if (backspaceTimer === null) {
          backspaceCount = 1;
          backspaceTimer = setTimeout(() => {
            backspaceTimer = null;
            backspaceCount = 0;
          }, 300);
        } else {
          backspaceCount++;
        }
        
        // Only remove tag if it's a single tap (not held)
        if (backspaceCount === 1) {
          removeLastTag();
        }
      }
    }

    // Clear prompt
    function clearPrompt() { 
      promptField.value = ''; 
      updateCounters(); 
      showToast('Cleared'); 
    }
    
    // Copy prompt to clipboard
    function copyPrompt() { 
      promptField.select();
      navigator.clipboard.writeText(promptField.value).then(() => {
        showToast('Copied to clipboard');
      });
    }

    function removeLastTag() {
      const tags = promptField.value.split(',').map(t => t.trim()).filter(t => t);
      if (tags.length > 0) {
        const removedTag = tags.pop();
        promptField.value = tags.join(', ');
        showToast(`Removed: ${removedTag}`);
        updateCounters();
      } else {
        showToast('No tags to remove', 'error');
      }
    }

    function rgbToHex(rgb) {
      const sep = rgb.indexOf(",") > -1 ? "," : " ";
      const parts = rgb.substr(4).split(")")[0].split(sep);
      let r = (+parts[0]).toString(16),
          g = (+parts[1]).toString(16),
          b = (+parts[2]).toString(16);
      if (r.length == 1) r = "0" + r;
      if (g.length == 1) g = "0" + g;
      if (b.length == 1) b = "0" + b;
      return "#" + r + g + b;
    }

    function getCurrentAccentHex() {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (computed.startsWith('#')) {
        return computed;
      } else if (computed.startsWith('rgb')) {
        return rgbToHex(computed);
      }
      return '#cba6f7'; // fallback
    }
    
    // Update counters
    function updateCounters() {
      const tags = promptField.value.split(',').filter(t => t.trim());
      tagCount.textContent = tags.length;
      charCount.textContent = promptField.value.length;
    }
    
    // Show toast notification
    function showToast(msg, type = 'success') {
      toast.textContent = msg;
      toast.className = 'toast show';
      setTimeout(() => toast.className = 'toast', 2000);
    }
    
    // Initialize app on load
    window.addEventListener('DOMContentLoaded', () => {
      initApp();
      populateSavedPromptsList();
    });
    
    // Global for keyboard navigation
    let currentSuggestionIndex = -1;
