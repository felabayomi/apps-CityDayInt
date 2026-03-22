# Daily Felix – City of the Day International

## Overview

Daily Felix – City of the Day International is a travel-focused web application that delivers one iconic international city every day, focused on the world's most popular tourist destinations. The AI generates content for globally recognised cities (Paris, Tokyo, Rome, Bangkok, etc.) covering morning discoveries (landmarks), afternoon experiences (food/culture), and evening insights (budget tips). The application uses AI-powered content generation through OpenAI's GPT models to create engaging, educational travel content while maintaining a lightweight, user-friendly experience.

The platform follows a freemium model with basic daily city access for all users and premium features for subscribers. It's designed as a Progressive Web App (PWA) that works offline and can be installed on mobile devices, making it accessible for daily consumption of travel inspiration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client is built with React 18 using TypeScript and Vite as the build tool. The UI framework is built on shadcn/ui components with Radix UI primitives, styled using Tailwind CSS with custom theming. The application uses Wouter for client-side routing, providing a lightweight alternative to React Router. State management is handled through TanStack React Query for server state and React's built-in state management for local component state.

The design system implements a travel-focused aesthetic with custom color schemes supporting both light and dark modes. The sidebar navigation uses a collapsible design optimized for both desktop and mobile experiences. The main content area displays city cards in an engaging card-based layout with morning, afternoon, and evening content sections.

### Backend Architecture
The server is built with Express.js running on Node.js with TypeScript. The application follows a RESTful API design pattern with clear separation of concerns between routes, middleware, and business logic. The authentication system integrates with Replit's OpenID Connect (OIDC) provider using Passport.js for secure user management.

Content generation leverages OpenAI's API (currently using GPT-5 model) to create daily city content including descriptions, cultural insights, food recommendations, and budget tips. The system includes an admin panel for content management, allowing manual city selection or automated AI generation with approval workflows.

### Data Storage Solutions
The application uses PostgreSQL as the primary database with Drizzle ORM for type-safe database operations. The database schema includes tables for users (required for Replit Auth), cities, city content, user saved cities, and travel plans. Session management is handled through PostgreSQL-backed sessions using connect-pg-simple.

The database structure supports the freemium model with user premium status tracking and subscription management. City content is structured to support the three-card daily format (morning, afternoon, evening) with support for images, affiliate links, and analytics tracking.

### Authentication and Authorization
Authentication is implemented using Replit's OpenID Connect system with Passport.js middleware. The system supports session-based authentication with secure HTTP-only cookies. User roles are managed through email-based admin detection, with plans for more sophisticated role-based access control.

The authentication flow includes automatic user creation on first login, profile management with user preferences, and premium subscription tracking. The system includes middleware for protecting routes and API endpoints based on authentication status.

## External Dependencies

### Third-Party Services
- **Replit Authentication**: OpenID Connect provider for user authentication and session management
- **OpenAI API**: GPT-5 model for AI-powered city content generation including descriptions, cultural insights, and travel recommendations
- **Neon Database**: PostgreSQL hosting service with serverless architecture for scalable database operations

### Development and Build Tools
- **Vite**: Modern build tool and development server with hot module replacement and optimized production builds
- **TypeScript**: Type safety across frontend and backend with strict configuration
- **Tailwind CSS**: Utility-first CSS framework with custom design system and theming
- **ESBuild**: Fast JavaScript bundler for server-side code compilation

### UI Component Libraries
- **Radix UI**: Accessible, unstyled component primitives for complex UI components like dialogs, dropdowns, and navigation
- **shadcn/ui**: Pre-built component library built on top of Radix UI with consistent styling and theming
- **Lucide React**: Icon library providing consistent iconography throughout the application

### Database and ORM
- **Drizzle ORM**: Type-safe ORM for PostgreSQL with schema migrations and query building
- **Drizzle Kit**: CLI tools for database schema management and migrations
- **@neondatabase/serverless**: Serverless PostgreSQL driver optimized for edge computing environments