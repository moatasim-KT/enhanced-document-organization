#!/bin/bash

# Simplified categorization functions for document organization
# This implements the 5-category system with pattern matching

# Main categories with their detection patterns
MAIN_CATEGORIES=(
    "🤖 AI & ML"
    "📚 Research Papers"
    "🌐 Web Content"
    "📝 Notes & Drafts"
    "💻 Development"
)

# Category detection patterns
declare -A CATEGORY_PATTERNS=(
    ["🤖 AI & ML"]="machine learning|neural network|transformer|llm|agent|computer vision|nlp|deep learning|ai|artificial intelligence|pytorch|tensorflow|keras|scikit|pandas|numpy|chatgpt|openai|hugging face|embedding|fine-tuning|prompt engineering|token|gpt|bert|llama|claude|stable diffusion|midjourney|dall-e|diffusion model|generative ai|rag|retrieval augmented|vector database|langchain|autogen|semantic kernel|reinforcement learning|supervised learning|unsupervised learning|classification|regression|clustering|dimensionality reduction|feature engineering|hyperparameter|optimization|backpropagation|gradient descent|activation function|loss function|epoch|batch size|overfitting|underfitting|validation|training data|test data|inference|model serving|model deployment|model monitoring|model drift|model versioning|model registry|model governance|model explainability|xai|explainable ai|responsible ai|ethical ai|bias in ai|fairness in ai|robustness|adversarial attack|data augmentation|transfer learning|zero-shot|few-shot|one-shot learning|multi-modal|vision-language|audio processing|speech recognition|text-to-speech|speech-to-text|natural language understanding|natural language generation|sentiment analysis|named entity recognition|question answering|summarization|translation|text classification|topic modeling|word embedding|sentence embedding|document embedding|knowledge graph|ontology|semantic web|knowledge representation|reasoning|planning|decision making|multi-agent system|swarm intelligence|federated learning|distributed learning|edge ai|tinyml|quantization|pruning|distillation|model compression"
    ["📚 Research Papers"]="abstract|introduction|methodology|references|doi:|arxiv:|journal|conference|conclusion|experiment|hypothesis|analysis|results|discussion|findings|evaluation|citation|bibliography|peer review|publication|proceedings|thesis|dissertation|preprint|postprint|manuscript|author contribution|acknowledgments|supplementary material|appendix|figure|table|equation|theorem|proof|lemma|corollary|proposition|definition|algorithm|pseudocode|empirical study|theoretical analysis|ablation study|comparative analysis|statistical significance|p-value|confidence interval|standard deviation|variance|mean|median|mode|quartile|percentile|correlation|causation|regression analysis|anova|t-test|chi-square|factor analysis|principal component analysis|cluster analysis|meta-analysis|systematic review|literature review|survey paper|position paper|technical report|white paper|case study|longitudinal study|cross-sectional study|qualitative research|quantitative research|mixed methods|data collection|sampling|population|validity|reliability|generalizability|limitations|future work|implications|applications|state-of-the-art|baseline|benchmark|performance metric|evaluation metric|human evaluation|automatic evaluation|reproducibility|replicability|open science|open data|open source|research question|research gap|research contribution|novelty|innovation|impact factor|h-index|citation count|peer-reviewed|double-blind|single-blind|open review|camera-ready|accepted|rejected|revise and resubmit|major revision|minor revision"
    ["🌐 Web Content"]="article|tutorial|guide|blog|news|web content|how-to|walkthrough|documentation|manual|reference|handbook|post|update|announcement|newsletter|podcast|webinar|video|course|lesson|module|chapter|section|subsection|topic|subtopic|headline|subheading|paragraph|bullet point|numbered list|checklist|tip|trick|hack|shortcut|best practice|common mistake|pitfall|warning|caution|important|remember|key takeaway|summary|conclusion|introduction|overview|background|context|prerequisite|requirement|dependency|installation|setup|configuration|customization|personalization|optimization|troubleshooting|debugging|error handling|problem solving|solution|workaround|alternative|comparison|versus|pros and cons|advantages|disadvantages|benefits|drawbacks|limitations|features|functionality|capability|use case|scenario|demo|demonstration|screenshot|illustration|diagram|infographic|chart|graph|figure|image|photo|picture|animation|gif|video|audio|podcast|transcript|caption|alt text|hyperlink|url|website|webpage|landing page|homepage|about page|contact page|faq|frequently asked questions|help center|knowledge base|support|customer service|feedback|comment|review|rating|star|like|share|subscribe|follow|bookmark|favorite|save for later|read more|continue reading|next page|previous page|pagination|search|filter|sort|category|tag|label|keyword|metadata|seo|search engine optimization|meta description|meta title|meta tag|header|footer|sidebar|navigation|menu|dropdown|accordion|tab|panel|modal|popup|tooltip|badge|button|link|form|input|textarea|checkbox|radio button|select|dropdown|submit|reset|cancel|confirm|yes|no|ok|done|finish|complete|continue|back|return|home"
    ["📝 Notes & Drafts"]="meeting notes|team meeting|daily notes|meeting minutes|agenda|action items|todo|to-do|reminder|personal note|journal|diary|log|record|reflection|observation|insight|realization|epiphany|breakthrough|discovery|exploration|investigation|inquiry|question|answer|solution|problem|challenge|opportunity|strength|weakness|threat|advantage|disadvantage|pro|con|argument|counterargument|point|counterpoint|perspective|viewpoint|opinion|belief|value|principle|priority|goal|objective|target|milestone|deadline|timeline|schedule|plan|strategy|tactic|approach|method|technique|process|procedure|workflow|pipeline|framework|structure|organization|outline|sketch|draft|revision|version|iteration|update|change|modification|amendment|correction|improvement|enhancement|refinement|polishing|finalization|completion|progress|status|state|condition|situation|context|environment|setting|scenario|case|instance|occurrence|event|incident|episode|experience|memory|recollection|reminder|note to self|memo|message|communication|conversation|discussion|dialogue|debate|negotiation|collaboration|cooperation|coordination|teamwork|partnership|alliance|relationship|connection|link|association|correlation|causation|implication|inference|deduction|induction|reasoning|logic|synthesis|assessment|judgment|decision|choice|option|alternative|possibility|probability|likelihood|certainty|uncertainty|risk|opportunity|benefit|cost|value|worth|importance|significance|relevance|applicability|usefulness|helpfulness|effectiveness|efficiency|productivity|performance|quality|quantity|measure|metric|indicator|signal|sign|symptom|cause|effect|result|outcome|consequence|impact|influence|factor|variable|parameter|attribute|characteristic|feature|aspect|dimension|element|component|part|whole|system|module|unit|entity|object|subject|topic|theme|motif|pattern|trend|direction|orientation|alignment|position|location|place|space|time|duration|period|interval|frequency|rate|speed|velocity|acceleration|momentum|force|energy|power|strength|intensity|magnitude|scale|scope|range|extent|degree|level|tier|layer|hierarchy|network|web|mesh|grid|matrix|array|list|collection|set|group|cluster|category|classification|taxonomy|ontology|schema|model|representation|abstraction|conceptualization|theory|hypothesis|assumption|premise|foundation|basis|ground|reason|rationale|justification|explanation|clarification|elaboration|expansion|extension|development|evolution|growth|maturation|progression|advancement|improvement|enhancement|optimization|maximization|minimization|reduction|elimination|removal|deletion|addition|insertion|inclusion|exclusion|separation|division|partition|segmentation|categorization|classification|organization|arrangement|ordering|sequencing|prioritization|ranking|rating|scoring|grading|evaluation|assessment|analysis|examination|investigation|exploration|discovery|learning|understanding|comprehension|knowledge|wisdom|insight|foresight|hindsight|retrospect|prospect|outlook|forecast|prediction|projection|estimation|approximation|calculation|computation|derivation|formulation|brainstorm|thought|concept|inspiration|innovation|idea|untitled|daily journal"
    ["💻 Development"]="code|api|git|database|framework|programming|software|documentation|kubernetes|docker|container|devops|ci/cd|frontend|backend|server|microservice|architecture|javascript|python|java|typescript|html|css|sql|nosql|algorithm|data structure|function|method|class|object|variable|constant|parameter|argument|return value|input|output|compile|interpret|execute|run|debug|test|unit test|integration test|end-to-end test|functional test|performance test|load test|stress test|security test|penetration test|vulnerability|exploit|patch|fix|bug|issue|error|exception|warning|failure|crash|freeze|hang|deadlock|race condition|memory leak|buffer overflow|null pointer|undefined reference|type error|syntax error|runtime error|logical error|semantic error|validation error|authentication error|authorization error|permission error|access control|security|privacy|encryption|decryption|hashing|signing|verification|certificate|key|token|credential|password|username|user|role|permission|privilege|access|restriction|limitation|constraint|rule|policy|standard|convention|best practice|pattern|anti-pattern|design pattern|architectural pattern|mvc|mvvm|flux|redux|observer|singleton|factory|builder|adapter|decorator|proxy|facade|bridge|composite|strategy|command|iterator|visitor|state|memento|chain of responsibility|mediator|interpreter|template method|flyweight|prototype|dependency injection|inversion of control|separation of concerns|single responsibility|open-closed|liskov substitution|interface segregation|dependency inversion|solid principles|dry|kiss|yagni|clean code|refactoring|code smell|technical debt|legacy code|monolith|microservice|serverless|function as a service|platform as a service|infrastructure as a service|software as a service|cloud computing|edge computing|fog computing|grid computing|distributed computing|parallel computing|concurrent computing|asynchronous|synchronous|blocking|non-blocking|event-driven|reactive|functional|procedural|object-oriented|imperative|declarative|markup|stylesheet|script|module|package|library|framework|sdk|api|rest|soap|graphql|grpc|websocket|http|https|tcp|udp|ip|dns|url|uri|query string|path parameter|header|cookie|session|state|stateless|cache|cdn|load balancer|proxy|reverse proxy|gateway|firewall|vpn|ssh|ftp|smtp|imap|pop3|database|sql|nosql|relational|document|key-value|graph|time-series|column-family|newSQL|orm|query|transaction|acid|base|cap theorem|sharding|replication|partitioning|indexing|normalization|denormalization|migration|seed|backup|restore|recovery|high availability|fault tolerance|disaster recovery|scalability|elasticity|performance|throughput|latency|response time|concurrency|parallelism|thread|process|job|task|queue|stack|heap|memory|cpu|gpu|disk|network|bandwidth|throughput|latency|jitter|packet loss|congestion|bottleneck|optimization|profiling|benchmarking|monitoring|logging|tracing|alerting|notification|dashboard|metrics|analytics|telemetry|observability|instrumentation|diagnostics|troubleshooting|debugging|breakpoint|watchpoint|step over|step into|step out|continue|pause|resume|stop|start|restart|deploy|release|version|tag|branch|merge|pull request|code review|static analysis|dynamic analysis|linting|formatting|documentation|comment|annotation|javadoc|docstring|markdown|restructuredtext|asciidoc|wiki|knowledge base|faq|tutorial|guide|manual|reference|specification|requirement|user story|acceptance criteria|definition of done|agile|scrum|kanban|sprint|backlog|story point|velocity|burndown|burnup|retrospective|standup|planning|review|demo|showcase|stakeholder|customer|client|user|actor|persona|role|responsibility|accountability|ownership|collaboration|communication|coordination|integration|interoperability|compatibility|portability|maintainability|reliability|availability|security|usability|accessibility|internationalization|localization|globalization|translation|language|culture|region|timezone|date format|number format|currency format|measurement unit|color scheme|theme|style|layout|responsive|adaptive|mobile-first|desktop-first|cross-platform|cross-browser|cross-device|progressive enhancement|graceful degradation|feature detection|polyfill|shim|fallback|vendor prefix|browser compatibility|device compatibility|operating system|platform|environment|development|staging|production|qa|testing|sandbox|local|remote|cloud|on-premise|hybrid|multi-cloud|infrastructure|architecture|topology|network|server|client|peer-to-peer|master-slave|leader-follower|active-passive|active-active|blue-green|canary|rolling|immutable|mutable|stateful|stateless|idempotent|atomic|transactional|eventual consistency|strong consistency|causal consistency|read consistency|write consistency|isolation level|read uncommitted|read committed|repeatable read|serializable|snapshot isolation|mvcc|optimistic locking|pessimistic locking|deadlock prevention|deadlock detection|deadlock recovery|livelock|starvation|priority inversion|resource allocation|resource management|garbage collection|memory management|reference counting|mark and sweep|generational|compaction|fragmentation|leak|overflow|underflow|boundary condition|edge case|corner case|happy path|sad path|error path|exception handling|try-catch|finally|throw|raise|propagate|bubble up|swallow|recover|retry|timeout|backoff|circuit breaker|bulkhead|rate limiting|throttling|debouncing|batching|pooling|caching|memoization|lazy loading|eager loading|preloading|prefetching|streaming|buffering|pagination|infinite scroll|virtual scrolling|windowing|rendering|painting|compositing|layout|reflow|repaint|animation|transition|transform|filter|blend mode|opacity|visibility|z-index|stacking context|box model|flexbox|grid|float|position|display|overflow|margin|padding|border|outline|shadow|gradient|background|foreground|text|font|typography|icon|image|svg|canvas|webgl|3d|animation|transition|transform|filter|blend mode|opacity|visibility|accessibility|aria|screen reader|keyboard navigation|focus management|tab order|color contrast|alternative text|semantic html|landmark|region|heading|list|table|form|input|validation|feedback|error message|success message|warning message|info message|toast|notification|alert|modal|dialog|popup|tooltip|dropdown|accordion|tab|panel|carousel|slider|gallery|lightbox|video player|audio player|media|streaming|progressive download|adaptive bitrate|codec|container|format|resolution|aspect ratio|frame rate|bitrate|quality|compression|lossless|lossy|metadata|exif|geolocation|timestamp|author|copyright|license|terms of service|privacy policy|cookie policy|gdpr|ccpa|hipaa|pci dss|sox|iso|compliance|regulation|standard|certification|audit|assessment|evaluation|review|inspection|verification|validation|approval|rejection|acceptance|denial|grant|revoke|enable|disable|activate|deactivate|register|unregister|subscribe|unsubscribe|publish|unpublish|broadcast|narrowcast|unicast|multicast|anycast|push|pull|sync|async|real-time|batch|scheduled|periodic|recurring|one-time|on-demand|event-driven|time-driven|data-driven|user-driven|system-driven|automatic|manual|interactive|passive|active|reactive|proactive|predictive|prescriptive|descriptive|diagnostic|monitoring|alerting|notification|reporting|analytics|business intelligence|data mining|machine learning|artificial intelligence|natural language processing|computer vision|speech recognition|recommendation|personalization|customization|configuration|setting|preference|option|flag|feature toggle|a/b testing|multivariate testing|experiment|hypothesis|control group|treatment group|conversion|funnel|retention|churn|acquisition|activation|revenue|referral|growth|viral|organic|paid|marketing|sales|customer|user|client|stakeholder|partner|vendor|supplier|provider|consumer|producer|prosumer|administrator|moderator|editor|author|contributor|viewer|reader|listener|watcher|follower|friend|connection|contact|member|subscriber|premium|free|trial|demo|beta|alpha|release candidate|stable|unstable|development|experimental|deprecated|sunset|end of life|maintenance|support|service level agreement|uptime|downtime|maintenance window|scheduled maintenance|unscheduled maintenance|incident|outage|degradation|resolution|mitigation|workaround|root cause analysis|post-mortem|retrospective|lessons learned|knowledge sharing|documentation|wiki|knowledge base|faq|help center|support portal|ticket|issue|bug|feature request|enhancement|improvement|suggestion|feedback|comment|review|rating|vote|poll|survey|questionnaire|interview|focus group|user testing|usability testing|a/b testing|multivariate testing|split testing|canary testing|blue-green deployment|feature flag|toggle|switch|configuration|setting|preference|option|default|override|custom|standard|template|boilerplate|scaffold|generator|wizard|assistant|helper|utility|tool|plugin|extension|addon|module|component|widget|gadget|app|application|service|daemon|process|thread|job|task|queue|stack|heap|memory|storage|disk|file|folder|directory|path|url|uri|endpoint|route|controller|model|view|template|layout|theme|style|design|user interface|user experience|frontend|backend|full-stack|client-side|server-side|database|data store|repository|cache|index|search|query|filter|sort|paginate|aggregate|join|union|intersection|difference|subset|superset|collection|list|array|set|map|dictionary|hash|tree|graph|network|mesh|grid|matrix|vector|scalar|number|string|boolean|date|time|datetime|timestamp|duration|interval|period|range|boundary|limit|threshold|minimum|maximum|average|mean|median|mode|sum|count|distinct|unique|duplicate|redundant|sparse|dense|empty|full|partial|complete|incomplete|valid|invalid|correct|incorrect|accurate|inaccurate|precise|imprecise|exact|approximate|estimated|calculated|measured|observed|predicted|projected|forecasted|historical|current|future|past|present|upcoming|scheduled|planned|actual|target|goal|objective|key result|metric|indicator|signal|noise|pattern|trend|anomaly|outlier|spike|dip|plateau|growth|decline|stable|unstable|volatile|steady|consistent|inconsistent|regular|irregular|periodic|aperiodic|cyclic|acyclic|linear|nonlinear|exponential|logarithmic|polynomial|rational|irrational|integer|float|double|decimal|binary|hexadecimal|octal|ascii|unicode|utf-8|utf-16|base64|md5|sha|hash|encrypt|decrypt|sign|verify|authenticate|authorize|identify|verify|validate|check|test|assert|expect|should|must|may|can|will|shall|should not|must not|may not|cannot|will not|shall not"
)

# Inbox locations across sync services
INBOX_LOCATIONS=(
    "$GOOGLE_DRIVE_PATH/Inbox"
    "$ICLOUD_SYNC_PATH/Inbox"
)

# Simplified analyze_content_category function
# This function analyzes file content and categorizes it into one of the 5 main categories
analyze_content_category() {
    local file="$1"
    local content=""
    local filename=$(basename "$file")
    
    # Skip if recently processed and incremental mode is enabled
    if [[ "$ENABLE_INCREMENTAL_PROCESSING" == "true" ]] && is_recently_processed "$file"; then
        # Return cached category
        local cached_category=$(grep "^${file}|" "$PROCESSED_FILES_DB" | cut -d'|' -f4)
        if [[ -n "$cached_category" ]]; then
            echo "$cached_category"
            return
        fi
    fi
    
    # Read content for analysis (first 50 lines + filename)
    content=$(head -50 "$file" 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "")
    content="$content $(echo "$filename" | tr '[:upper:]' '[:lower:]')"
    
    # Define priority order for categories (check Notes & Drafts first for specific phrases)
    local priority_categories=(
        "📝 Notes & Drafts"
        "🤖 AI & ML"
        "📚 Research Papers"
        "💻 Development"
        "🌐 Web Content"
    )
    
    # First check for multi-word patterns that are more specific
    for category in "${priority_categories[@]}"; do
        local pattern="${CATEGORY_PATTERNS[$category]}"
        
        # Extract multi-word patterns (containing spaces)
        local IFS="|"
        for part in $pattern; do
            if [[ "$part" == *" "* ]]; then
                if echo "$content" | grep -q "$part"; then
                    echo "$category"
                    return
                fi
            fi
        done
    done
    
    # Then check for regular patterns
    for category in "${MAIN_CATEGORIES[@]}"; do
        local pattern="${CATEGORY_PATTERNS[$category]}"
        if [[ -n "$pattern" ]] && echo "$content" | grep -qE "($pattern)"; then
            echo "$category"
            return
        fi
    done
    
    # Check for custom categories if defined
    if [[ -f "$CUSTOM_CATEGORIES_FILE" ]]; then
        while IFS='|' read -r cat_name cat_emoji cat_keywords cat_date; do
            if [[ -n "$cat_keywords" ]]; then
                # Replace commas with pipe for regex OR
                local custom_pattern=$(echo "$cat_keywords" | tr ',' '|')
                if echo "$content" | grep -qE "($custom_pattern)"; then
                    echo "$cat_emoji $cat_name"
                    return
                fi
            fi
        done < "$CUSTOM_CATEGORIES_FILE"
    fi
    
    # Fallback to Notes & Drafts if no match found
    echo "📝 Notes & Drafts"
}

# Function to check if content matches a specific category
matches_category() {
    local content="$1"
    local category="$2"
    local pattern="${CATEGORY_PATTERNS[$category]}"
    
    if [[ -n "$pattern" ]] && echo "$content" | grep -qE "($pattern)"; then
        return 0  # Match found
    else
        return 1  # No match
    fi
}

# Function to process files from Inbox folders
process_inbox_folders() {
    for inbox_path in "${INBOX_LOCATIONS[@]}"; do
        if [[ -d "$inbox_path" ]]; then
            echo "Processing Inbox: $inbox_path"
            
            # Find all files in the Inbox
            find "$inbox_path" -type f | while read -r file; do
                # Determine category
                local category=$(analyze_content_category "$file")
                
                # Create category folder if it doesn't exist
                mkdir -p "$category"
                
                # Move file to category folder
                local filename=$(basename "$file")
                echo "Moving: $filename -> $category"
                
                # Use move_file_enhanced if available, otherwise simple move
                if type move_file_enhanced &>/dev/null; then
                    move_file_enhanced "$file" "$category" true
                else
                    mv "$file" "$category/"
                fi
            done
        else
            echo "Creating Inbox folder: $inbox_path"
            mkdir -p "$inbox_path"
        fi
    done
}