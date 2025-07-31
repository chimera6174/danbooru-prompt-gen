    // Global variables
    let appTags = {};
    let allTags = [];
    let descriptionsAvailable = true;
    let backspaceTimer = null;
    let backspaceCount = 0;
    let wasUnifiedInputFocused = false;
    const categoriesDiv = document.getElementById("categories");
    const tagContainer = document.getElementById("tagContainer");
    const promptField = document.getElementById("promptField");
    const unifiedInput = document.getElementById("unifiedInput");
    const tagCount = document.getElementById("tagCount");
    const charCount = document.getElementById("charCount");
    const toast = document.getElementById("toast");
    const suggestionsDropdown = document.getElementById("suggestionsDropdown");
    const descriptionToggle = document.getElementById("descriptionToggle");
    const tagsFileInput = document.getElementById("tagsFileInput");
    
    // Tag Management
    let currentTags = [];
    let focusedTagIndex = -1;

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
      renderTags();
    }

    function renderTags() {
      tagContainer.innerHTML = '';
      
      currentTags.forEach((tag, index) => {
        const tagEl = document.createElement('div');
        tagEl.className = 'tag-item';
        tagEl.draggable = true;
        tagEl.dataset.index = index;
        
        if (index === focusedTagIndex) {
          tagEl.classList.add('focused');
        }
        
        const tagText = document.createElement('span');
        tagText.textContent = tag;
        tagEl.appendChild(tagText);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          removeTagAtIndex(index);
        };
        tagEl.appendChild(removeBtn);
        
        // Click to focus
        tagEl.addEventListener('click', (e) => {
          if (e.target !== removeBtn) {
            setFocusedIndex(index);
          }
          if (wasUnifiedInputFocused) unifiedInput.focus();
        });
        
        tagContainer.appendChild(tagEl);
      });
      
      // Update counters
      updateCounters();
      
      // Set focus to last tag if none focused
      if (focusedTagIndex === -1 && currentTags.length > 0) {
        setFocusedIndex(currentTags.length - 1);
      }
    }
    function setFocusedIndex(index) {
      focusedTagIndex = index;
      renderTags();
    }
    function addTagToPrompt(tag) {
      if (!currentTags.includes(tag)) {
        // Insert after focused tag
        const insertIndex = focusedTagIndex === -1 ? 
          currentTags.length : 
          Math.min(focusedTagIndex + 1, currentTags.length);
        
        currentTags.splice(insertIndex, 0, tag);
        setFocusedIndex(insertIndex);
        showToast(`${tag} added`);
        
        // Add visual feedback to tag in categories
        const tagEls = document.querySelectorAll('.tag-container');
        tagEls.forEach(el => {
          if (el.querySelector('.tag').textContent === tag) {
            el.classList.add('tag-highlight');
            setTimeout(() => el.classList.remove('tag-highlight'), 1500);
          }
        });
      }
    }
    function removeTagAtIndex(index) {
      if (index >= 0 && index < currentTags.length) {
        const removedTag = currentTags.splice(index, 1)[0];
        
        // Adjust focus
        if (currentTags.length === 0) {
          focusedTagIndex = -1;
        } else if (index === focusedTagIndex) {
          setFocusedIndex(Math.min(index, currentTags.length - 1));
        } else if (index < focusedTagIndex) {
          setFocusedIndex(focusedTagIndex - 1);
        }
        
        showToast(`Removed: ${removedTag}`);
        renderTags();
      }
    }
    function removeFocusedTag() {
      if (focusedTagIndex >= 0) {
        removeTagAtIndex(focusedTagIndex);
      } else {
        showToast('No tags to remove', 'error');
      }
    }
    function swapTags(index1, index2) {
      if (index1 >= 0 && index2 >= 0 && 
          index1 < currentTags.length && 
          index2 < currentTags.length) {
        [currentTags[index1], currentTags[index2]] = 
          [currentTags[index2], currentTags[index1]];
        
        // Update focus if needed
        if (focusedTagIndex === index1) {
          setFocusedIndex(index2);
        } else if (focusedTagIndex === index2) {
          setFocusedIndex(index1);
        } else {
          renderTags();
        }
      }
    }
    function updateCounters() {
      tagCount.textContent = currentTags.length;
      charCount.textContent = currentTags.join(', ').length;
      currentTags.join(', ')
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

      tagContainer.addEventListener('pointerdown', e => {
        wasUnifiedInputFocused = (document.activeElement === unifiedInput);
      }); 
      
      // Close dropdown when clicking outside
      document.addEventListener('click', function(e) {
        if (!unifiedInput.contains(e.target) && 
            !suggestionsDropdown.contains(e.target)) {
          suggestionsDropdown.style.display = 'none';
        }
      });
      
      // Hide dropdown on scroll/resize (Not needed for now)
      // window.addEventListener('scroll', function() {
      //   suggestionsDropdown.style.display = 'none';
      // });
      //
      // window.addEventListener('resize', function() {
      //   suggestionsDropdown.style.display = 'none';
      // });
      
      addEventListener('input', updateCounters);
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
      fetch('./data/danbooru.json')
        .then(res => res.json())
        .then(array => {
          // array is [ { tag: "...", description: "..." }, ... ]
          const mapped = array.map(e => ({
            tag: e.tag,
            desc: e.description  // map "description" → "desc"
          }));
          // stick them in one category
          appTags = { "Danbooru Tags": mapped };
          descriptionsAvailable = true;        // now we have real descriptions
          saveTagsToStorage('json');           // remember format
          renderCategories();                  // rebuild UI
          toggleDescriptions(descriptionToggle.checked);
          showToast('Danbooru tags (with descriptions) loaded');
        })
        .catch(err => {
          console.error('Error loading Danbooru JSON:', err);
          showToast('Error loading Danbooru tags', 'error');
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

    function savePrompt() {
      const name = document.getElementById('promptNameInput').value.trim();
      const prompt = currentTags.join(', ');
      
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
      const savedPrompts = JSON.parse(localStorage.getItem('savedPrompts') || '{}');
      const prompt = savedPrompts[name];
      
      if (prompt) {
        currentTags = prompt.split(',').map(t => t.trim()).filter(t => t);
        setFocusedIndex(currentTags.length - 1);
        showToast(`"${name}" loaded`);
      }
    }

    function deleteSavedPrompt(name) {
      if (!name) {
        showToast('Prompt name not provided', 'error');
        return;
      }
      
      const savedPrompts = JSON.parse(localStorage.getItem('savedPrompts') || '{}');
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
      
      const savedPrompts = JSON.parse(localStorage.getItem('savedPrompts') || '{}');
      
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
      const savedPrompts = JSON.parse(localStorage.getItem('savedPrompts') || '{}');
      const prompt = savedPrompts[name];
      
      if (prompt) {
        navigator.clipboard.writeText(prompt).then(() => {
          showToast(`"${name}" copied to clipboard`);
        });
      }
    }

    // Handle unified add (custom tag or selected suggestion)
    function handleUnifiedAdd() {
      const raw = unifiedInput.value.trim();
      if (!raw) {
        showToast("Enter a tag", 'error');
        return;
      }

      let tagsToAdd = [];
      if (raw.includes(',')) {
        tagsToAdd = raw
          .split(',')
          .map(t => t.trim())
          .filter(t => t);
      } 
      else if (currentSuggestionIndex >= 0) {
        const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
        const tagEl = items[currentSuggestionIndex]?.querySelector('.tag');
        if (tagEl) tagsToAdd = [tagEl.textContent];
      } 
      else {
        tagsToAdd = [raw];
      }
      tagsToAdd.forEach(tag => addTagToPrompt(tag));

      unifiedInput.value = '';
      suggestionsDropdown.style.display = 'none';
      currentSuggestionIndex = -1;
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

      // Tag navigation when input is empty
      if (unifiedInput.value === '') {
        if (e.shiftKey && e.key === 'ArrowLeft' && focusedTagIndex > 0) {
          e.preventDefault();
          swapTags(focusedTagIndex, focusedTagIndex - 1);
        }
        else if (e.shiftKey && e.key === 'ArrowRight' && focusedTagIndex < currentTags.length - 1) {
          e.preventDefault();
          swapTags(focusedTagIndex, focusedTagIndex + 1);
        }
        // 2) plain arrows → just move focus
        else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusedIndex(Math.max(0, focusedTagIndex - 1));
        }
        else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusedIndex(Math.min(currentTags.length - 1, focusedTagIndex + 1));
        }

        // Backspace to remove focused tag
        else if (e.key === 'Backspace') {
          e.preventDefault();
          removeFocusedTag();
        }
        // Ctrl+C to copy
        else if (e.ctrlKey && e.key === 'c') {
          e.preventDefault();
          copyPrompt();
        }
      }
    }

    // Clear prompt
    function clearPrompt() { 
      currentTags = [];
      focusedTagIndex = -1;
      renderTags();
      showToast('Cleared'); 
    }
    
    // Copy prompt to clipboard
    function copyPrompt() { 
      navigator.clipboard.writeText(currentTags.join(', ')).then(() => {
        showToast('Copied to clipboard');
      });
    }

    // Remove last tag
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
      new Sortable(tagContainer, {
        animation: 150,                 // smooth slide
        ghostClass: 'tag-item--ghost',  // CSS class for the dragged clone
        onEnd: evt => {
          const moved = currentTags.splice(evt.oldIndex, 1)[0];
          currentTags.splice(evt.newIndex, 0, moved);
          focusedTagIndex = evt.newIndex;
          renderTags();
          if (wasUnifiedInputFocused) unifiedInput.focus();
        }
      });
    });
    // Global for keyboard navigation
    let currentSuggestionIndex = -1;
