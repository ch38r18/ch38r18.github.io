let searchCallback = async () => {
    let data = await fetchData();
    let blocks = data.map(page => split(page)).flat();
    let fuse = newFuse(blocks);

    document.querySelector("#searchInput").onkeyup = (event) => {
        let term = event.target.value.trim();
        search(term)
    }

    /**
     * Fetch data.
     * Hugo can output json search indexes. See https://gohugo.io/templates/output-formats.
     */
    async function fetchData() {
        try {
            const response = await fetch('/index.json');
            return response.json()
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Split whole page content by h2 and h3.
     */
    function split(page) {
        let basePageLabel = new URL(page.permalink)
            .pathname
            .replace(/.html$/, "")
            .split("/")
            .map(item => decodeURIComponent(item.trim()))
            .filter(Boolean)
            .join(" / ")

        let blocks = [{
            title: page.title,
            label: basePageLabel,
            level: 1,
            permalink: page.permalink,
            content: ""
        }];

        let content = "";

        let HTMLCollection = new DOMParser().parseFromString(page.htmlString, 'text/html').querySelector("body").children;

        for (const element of HTMLCollection) {
            let block = {
                title: element.innerText,
                permalink: `${page.permalink}#${element.getAttribute("id")}`,
                content: ""
            }

            if (element.nodeName == 'H2') {
                block.label = `${basePageLabel} / ${element.innerText}`;
                block.level = 2
                blocks.push(block)
                content = ""
            } else if (element.nodeName == 'H3') {
                let Headings = blocks.filter(block => block.level < 3);

                block.label = Headings[Headings.length - 1].label + " / " + element.innerText;
                block.level = 3
                blocks.push(block)
                content = ""
            } else {
                let text = element.innerText
                if (element.classList.contains("highlight")) {
                    text = element.querySelector("code[data-lang]").innerText
                }
                content += `${angleBrackets2Entity(text)} `;
                blocks[blocks.length - 1].content = content
            }
        }
        return blocks;
    }

    /**
     * Convert angle brackets to entity.
     * "<" to "&lt;"
     * ">" to "&gt;"
     */
    function angleBrackets2Entity(string) {
        return string.replace(/[<>]/g, function (c) {
            return { "<": "&lt;", ">": "&gt;" }[c];
        });
    }

    /**
     * Get fuse instance.
     */
    function newFuse(blocks) {
        var options = {
            shouldSort: true,
            minMatchCharLength: 2,
            includeScore: true,
            includeMatches: true,
            ignoreLocation: true,
            useExtendedSearch: true,
            threshold: 0.2,
            keys: [
                {
                    name: "title",
                    weight: 2
                },
                {
                    name: "content",
                    weight: 1
                },
            ]
        };

        return new Fuse(blocks, options);
    }

    /**
     * Search.
     */
    function search(term) {
        if (term == "") return;

        term = angleBrackets2Entity(term);

        let results = fuse.search(term);

        if (results.length) {
            showSearchResults(results, term.length);
        }
    }

    /**
     * Show search results.
     */
    function showSearchResults(results, termLength) {
        document.querySelector("#searchResults").style.visibility = "visible";

        let html = '';

        results.forEach(item => {
            html += `
                <li>
                    <a href= ${item.item.permalink}  tabindex="0">
                        <div class="title">${item.item.label} </div>
                       ${highlight(item, termLength)}
                    </a>
                </li>
            `;
        });

        document.querySelector("#searchResults").innerHTML = html;
    }

    /**
     * Highlight given search result. 
     * https://fusejs.io/api/options.html#includematches
     */
    function highlight(item, termLength) {
        let match = item.matches[0];

        if (match.key == "title") return "";

        let content = match.value;

        let highlight = match.indices
            // https://github.com/krisk/Fuse/issues/409#issuecomment-623160126
            .filter(range => range[1] - range[0] + 1 >= termLength)
            .slice(0, 4)
            .map(range => {
                let offset = 15;

                let prefixStart = range[0] - offset <= 0 ? 0 : range[0] - offset;
                let prefix = content.slice(prefixStart, range[0]);

                let suffixEnd = range[1] + 1 + offset >= content.length ? content.length : range[1] + 1 + offset;
                let suffix = content.slice(range[1] + 1, suffixEnd);

                let highlight = content.slice(range[0], range[1] + 1)

                let punctuations = [
                    " ",
                    ",",
                    "，",
                    ".",
                    "。",
                    "!",
                    "！",
                    "？",
                    "?",
                ];

                // Append "..." to start if the prefix is truncated
                if (prefixStart != 0) {
                    let startIndex = range[0] - prefix.trim().length;
                    let beforePrefixStart = content.slice(startIndex - 1, startIndex)
                    if (!punctuations.includes(beforePrefixStart)) {
                        prefix = `...${prefix}`
                    }
                }

                // Append "..." to end if the sentence is truncated
                if (suffixEnd != content.length) {
                    let endIndex = range[1] + suffix.trim().length;
                    let afterSuffixEnd = content.slice(endIndex, endIndex + 1)
                    if (!punctuations.includes(afterSuffixEnd)) {
                        suffix = `${suffix}...`
                    }
                }

                return `${prefix}<span class="highlight">${highlight}</span>${suffix}`
            })
            .join(`&nbsp;&nbsp;&nbsp;&nbsp;`)

        if (!highlight) return "";

        return `<div class="highlight-container">${highlight}</div>`
    }

    /**
     * When click search icon toggle Search Box show or hidden.
     */
    document.querySelector("#searchIcon").addEventListener("click", event => {
        toggleSearchBox();
    })

    /**
     * Toggle Search Box show or hidden. 
     */
    function toggleSearchBox() {
        if (isSearchBoxShow()) {
            hiddenSearchBox()
        } else {
            showSearchBox()
        }
    }

    function isSearchBoxShow() {
        return document.querySelector("#searchBox").style.visibility == "visible"
    }

    /**
     * Show Search Box.
     */
    function showSearchBox() {
        document.querySelector("#searchBox").style.visibility = "visible";
        document.querySelector("#searchResults").style.visibility = "visible";
        document.querySelector("#searchInput").value = "";
        document.querySelector("#searchInput").focus();
    }

    /**
     * Hidden Search Box.
     */
    function hiddenSearchBox() {
        document.querySelector("#searchBox").style.visibility = "hidden";
        document.querySelector("#searchResults").style.visibility = "hidden";
        document.activeElement.blur();
    }

    /**
     * When click area(except search icon) outside the search box hidden search box.
     */
    document.addEventListener("click", event => {
        var input = document.querySelector("#searchInput");
        var icon = document.querySelector("#searchIcon");
        var target = event.target;

        if (input != target && icon != target) {
            hiddenSearchBox()
        }
    })

    /**
     * Allow control search box by keyboard.
     */
    document.addEventListener('keydown', function (event) {
        // Ctrl + p
        if (event.ctrlKey && event.keyCode === 80) {
            // Stop print window open.
            event.preventDefault();

            // Toggle Search Box show or hidden. 
            toggleSearchBox();
        }

        // ESC 
        if (event.keyCode == 27) {
            // Hidden search box.
            hiddenSearchBox()
        }

        // Enter 
        if (event.keyCode == 13) {
            // Hidden search box.
            if (isSearchBoxShow()) {
                setTimeout(() => {
                    hiddenSearchBox()
                }, 10);
            };
        }


        // Down arrow
        if (event.keyCode == 40 || event.keyCode == 38) {
            if (!isSearchBoxShow()) return;

            let input = document.querySelector('#searchInput');

            // <a> tags.
            let links = document.querySelector('#searchResults').querySelectorAll("a");

            // No search result.
            if (links.length == 0) return;

            // First <a> element.
            let first = links[0]

            // Last <a> element.
            let last = links[links.length - 1];

            // Stop window from scrolling.
            event.preventDefault();

            // Down arrow.
            if (event.keyCode == 40) {
                // If the currently focused element is the main input. Focus the first <a>.
                if (document.activeElement == input) {
                    first.focus();
                }
                // If we're at the bottom, stay there.
                else if (document.activeElement == last) {
                    last.focus();
                }
                // Otherwise select the next search result.
                else {
                    // document -> focused <a> -> <li> -> next<li> -> <a>
                    document.activeElement.parentElement.nextElementSibling.firstElementChild.focus();
                }
            }

            // Up arrow
            if (event.keyCode == 38) {
                // If we're in the input box, do nothing
                if (document.activeElement == input) {
                    input.focus();
                }
                // If we're at the first item, go to input box
                else if (document.activeElement == first) {
                    input.focus();
                }
                // Otherwise, select the search result above the current active one
                else {
                    // document -> focused <a> -> <li> -> previous<li> -> <a>
                    document.activeElement.parentElement.previousElementSibling.firstElementChild.focus();
                }
            }
        }
    });
}

addLoadEvent(searchCallback)