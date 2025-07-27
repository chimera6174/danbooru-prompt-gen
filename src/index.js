    // Global variables
    let appTags = {};
    let allTags = [];
    let descriptionsAvailable = true;
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
      
      // Set up event listeners
      setupEventListeners();
      updateCounters();
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
      fetch('../tags/default.json')
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
          } else if (fileExtension === 'txt') {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());
            appTags = {
              "Custom Tags": lines.map(tag => ({ tag: tag.trim(), desc: "" }))
            };
            descriptionsAvailable = false;
            saveTagsToStorage('txt');
            showToast('Text tags loaded');
            
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
        
        // Reset file input
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
      
      // Render each category
      Object.entries(appTags).forEach(([cat, tags]) => {
        const card = document.createElement('div'); 
        card.className = 'category-card';
        
        const header = document.createElement('div'); 
        header.className = 'category-header';
        header.onclick = () => card.classList.toggle('collapsed');
        header.innerHTML = `<h2><i class="fas fa-folder"></i> ${cat}</h2><i class="fas fa-chevron-down"></i>`;
        card.appendChild(header);
        
        const section = document.createElement('div'); 
        section.className = 'tag-section';
        
        tags.forEach(({tag, desc}) => {
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
        });
        
        card.appendChild(section);
        categoriesDiv.appendChild(card);
      });
      
      // Collapse all categories by default
      document.querySelectorAll('.category-card').forEach(card => {
        card.classList.add('collapsed');
      });
      
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
    
    // Add random tags
    function addRandomTags() {
      if (allTags.length === 0) {
        showToast('Load tags first', 'error');
        return;
      }
      
      // Shuffle tags and pick 5 random ones
      const shuffled = [...allTags].sort(() => 0.5 - Math.random());
      shuffled.slice(0, 5).forEach(tagObj => addTagToPrompt(tagObj.tag));
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
    window.addEventListener('DOMContentLoaded', initApp);
    
    // Global for keyboard navigation
    let currentSuggestionIndex = -1;
