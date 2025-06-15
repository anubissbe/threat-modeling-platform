# Threat Modeling Platform - Frontend

A modern React application for enterprise threat modeling with support for multiple methodologies.

## Features

- **Modern React**: Built with React 18, TypeScript, and Vite
- **Material-UI Design**: Professional enterprise interface
- **Redux Toolkit**: State management with RTK Query
- **Authentication**: JWT-based auth with automatic token refresh
- **Real-time Updates**: Live collaboration features
- **Responsive Design**: Mobile-first responsive layout
- **Dark/Light Theme**: Theme switching support
- **Accessibility**: WCAG 2.1 compliant
- **PWA Ready**: Service worker and offline support

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI) v5
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors
- **Forms**: React Hook Form with Zod validation
- **Testing**: Vitest + React Testing Library
- **Styling**: Emotion CSS-in-JS

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start development server
npm run dev
```

The application will be available at `http://localhost:3006`.

### Environment Configuration

Configure the following environment variables in `.env`:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_SSO=false
VITE_ENABLE_COLLABORATION=true
```

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Testing
npm test             # Run tests
npm run test:ui      # Run tests with UI
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint         # ESLint check
npm run lint:fix     # Fix ESLint issues
npm run typecheck    # TypeScript type checking
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
```

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout/         # Layout components (AppBar, Sidebar)
│   ├── Notifications/  # Notification system
│   └── ProtectedRoute.tsx
├── pages/              # Route-level components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Login.tsx       # Authentication
│   ├── Projects.tsx    # Project management
│   └── ThreatModels.tsx # Threat model management
├── store/              # Redux store configuration
│   ├── index.ts        # Store setup
│   └── slices/         # Redux slices
├── services/           # API services
│   └── api.ts          # Axios configuration and API calls
├── theme/              # Material-UI theme
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Features & Pages

### Authentication
- **Login**: JWT-based authentication with form validation
- **Token Management**: Automatic refresh with secure storage
- **Role-based Access**: Different permissions per user role

### Dashboard
- **Overview**: Key metrics and statistics
- **Recent Activity**: Latest threat modeling activities
- **Quick Actions**: Fast access to common operations
- **Project Status**: Current project progress

### Projects
- **Project Management**: Create, edit, and organize projects
- **Collaboration**: Multi-user project access
- **Progress Tracking**: Visual progress indicators
- **Search & Filter**: Find projects quickly

### Threat Models
- **Multi-methodology**: Support for STRIDE, PASTA, LINDDUN, VAST, DREAD
- **Visual Editor**: Drag-and-drop threat model creation
- **Risk Assessment**: Automated risk scoring
- **Export Options**: PDF, JSON, and other formats

## State Management

The application uses Redux Toolkit for state management:

### Auth Slice
- User authentication state
- JWT token management
- User profile information
- Login/logout actions

### UI Slice
- Theme preferences (light/dark)
- Sidebar state
- Notification system
- Global loading states

### API Integration
- Automatic token refresh
- Request/response interceptors
- Error handling and retry logic
- Offline support

## Authentication Flow

1. **Login**: User provides credentials
2. **Token Storage**: JWT tokens stored in localStorage
3. **API Requests**: Automatic token attachment
4. **Token Refresh**: Automatic refresh before expiration
5. **Logout**: Token cleanup and redirect

## Routing

The application uses React Router v6 with protected routes:

```typescript
// Public routes
/login              # Authentication page

// Protected routes (require authentication)
/                   # Dashboard
/projects           # Project management
/threat-models      # Threat model management
/risk-assessment    # Risk assessment tools
/admin/*            # Admin pages (admin role only)
```

## Theme System

Material-UI theme with customizations:

- **Colors**: Primary, secondary, and semantic colors
- **Typography**: Roboto font with size scale
- **Components**: Custom button, card, and form styles
- **Dark Mode**: Automatic theme switching
- **Responsive**: Mobile-first breakpoints

## Testing

Comprehensive testing setup with Vitest:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

Test categories:
- **Unit Tests**: Component and utility testing
- **Integration Tests**: API and store testing
- **E2E Tests**: Full user journey testing

## Security

Security features implemented:

- **Content Security Policy**: XSS protection
- **HTTPS Enforcement**: Secure communication
- **Token Security**: Secure JWT storage and rotation
- **Input Validation**: Client-side validation with Zod
- **Role-based Access**: Route and component protection

## Performance

Optimization techniques:

- **Code Splitting**: Lazy loading of routes
- **Bundle Optimization**: Vite build optimizations
- **Image Optimization**: WebP format and lazy loading
- **Caching**: Service worker for offline support
- **Tree Shaking**: Remove unused code

## Accessibility

WCAG 2.1 AA compliance:

- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: ARIA labels and semantic HTML
- **Color Contrast**: Sufficient contrast ratios
- **Focus Management**: Visible focus indicators
- **Alternative Text**: Image descriptions

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow TypeScript best practices
2. Write tests for new features
3. Use Material-UI components consistently
4. Follow the established code style
5. Update documentation for new features

## Performance Monitoring

- Bundle analyzer for size optimization
- Lighthouse audits for performance
- Core Web Vitals monitoring
- Error tracking and reporting