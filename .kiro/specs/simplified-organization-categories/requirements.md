# Requirements Document

## Introduction

This feature simplifies the document organization system from 47+ specialized categories to 5 main categories, focusing on the core document types found in the Inbox folders across synced locations (google_drive, icloud_sync). The system should maintain flexibility by allowing users to create new categories as needed.

## Requirements

### Requirement 1

**User Story:** As a user, I want a simplified folder structure with 5 main categories so that document organization is more manageable and less overwhelming.

#### Acceptance Criteria

1. WHEN the system organizes documents THEN it SHALL use only these 5 main categories:
   - 🤖 AI & ML
   - 📚 Research Papers  
   - 🌐 Web Content
   - 📝 Notes & Drafts
   - 💻 Development
2. WHEN the system processes files THEN it SHALL categorize them into one of these 5 main categories
3. WHEN the system encounters the existing 47+ category structure THEN it SHALL migrate files to the appropriate main category

### Requirement 2

**User Story:** As a user, I want the system to work with Inbox folders in my synced locations so that new documents are automatically processed from a central intake point.

#### Acceptance Criteria

1. WHEN the system runs THEN it SHALL process files from Inbox folders in:
   - google_drive/Inbox
   - icloud_sync/Inbox
2. WHEN files are found in Inbox folders THEN they SHALL be categorized and moved to appropriate main category folders
3. WHEN Inbox folders don't exist THEN the system SHALL create them automatically

### Requirement 3

**User Story:** As a user, I want the ability to create new categories when needed so that the system can adapt to my evolving document organization needs.

#### Acceptance Criteria

1. WHEN I need a new category THEN the system SHALL provide a mechanism to create it
2. WHEN a new category is created THEN it SHALL be available for future document categorization
3. WHEN creating a new category THEN it SHALL follow the emoji + name format (e.g., "📊 Data Analysis")
4. WHEN a new category is created THEN the categorization logic SHALL be updated to recognize it

### Requirement 4

**User Story:** As a user, I want the categorization logic to be simplified and focused so that documents are more accurately placed in the main categories.

#### Acceptance Criteria

1. WHEN analyzing AI & ML content THEN the system SHALL detect keywords like: machine learning, neural networks, transformers, LLMs, agents, computer vision, NLP
2. WHEN analyzing Research Papers THEN the system SHALL detect academic structure: abstract, introduction, methodology, references, DOI, arXiv
3. WHEN analyzing Web Content THEN the system SHALL detect: articles, tutorials, guides, blog posts, news
4. WHEN analyzing Notes & Drafts THEN the system SHALL detect: meeting notes, daily notes, ideas, drafts, untitled documents
5. WHEN analyzing Development content THEN the system SHALL detect: code, APIs, documentation, git, databases, frameworks

### Requirement 5

**User Story:** As a user, I want the system to maintain backward compatibility so that existing organized documents are properly migrated to the new structure.

#### Acceptance Criteria

1. WHEN the system encounters existing categorized documents THEN it SHALL map them to the appropriate main category
2. WHEN migrating from old categories THEN the system SHALL preserve file metadata and timestamps
3. WHEN migration is complete THEN old empty category folders SHALL be archived
4. WHEN migration occurs THEN a backup SHALL be created before any changes

### Requirement 6

**User Story:** As a user, I want configuration options for the simplified system so that I can customize behavior while maintaining simplicity.

#### Acceptance Criteria

1. WHEN configuring the system THEN I SHALL be able to enable/disable the simplified categorization mode
2. WHEN in simplified mode THEN the system SHALL use only the 5 main categories plus any user-created ones
3. WHEN adding custom categories THEN they SHALL be stored in the configuration
4. WHEN the system runs THEN it SHALL respect the simplified categorization setting