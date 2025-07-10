// Create tasks in ProjectHub for Threat Modeling Platform implementation
const API_URL = 'http://192.168.1.24:3009/api';

async function createTasks() {
  try {
    // First, login to get token
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@projecthub.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.statusText}`);
    }

    const { token } = await loginResponse.json();
    console.log('✅ Logged in successfully');

    // Get or create project
    const projectsResponse = await fetch(`${API_URL}/projects`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const projects = await projectsResponse.json();
    let project = projects.find(p => p.name.includes('Threat Modeling'));
    
    if (!project) {
      // Create project
      const createProjectResponse = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Threat Modeling Platform',
          description: 'Enterprise-grade threat modeling platform with multi-methodology support, AI features, and DevSecOps integration',
          status: 'active'
        })
      });
      
      project = await createProjectResponse.json();
      console.log('✅ Created project:', project.name);
    } else {
      console.log('✅ Found existing project:', project.name);
    }

    // Tasks to create
    const tasks = [
      {
        title: 'Connect Projects Frontend to Backend API',
        description: 'Replace mock data in Projects page with actual API calls to backend. Implement getProjects, createProject, updateProject, deleteProject functionality.',
        priority: 'high',
        status: 'todo',
        project_id: project.id,
        assigned_to: 'Claude'
      },
      {
        title: 'Implement Project Details View',
        description: 'Create a detailed project view page showing all project information, associated threat models, team members, and activity history.',
        priority: 'high',
        status: 'todo',
        project_id: project.id,
        assigned_to: 'Claude'
      },
      {
        title: 'Connect Threat Models Frontend to Backend',
        description: 'Replace mock data with actual API calls for threat models. Implement CRUD operations for threat models.',
        priority: 'high',
        status: 'todo',
        project_id: project.id,
        assigned_to: 'Claude'
      },
      {
        title: 'Complete Threat Model Visual Editor',
        description: 'Implement save/load functionality for the DFD editor. Connect to Diagram Service API for persistence.',
        priority: 'high',
        status: 'todo',
        project_id: project.id,
        assigned_to: 'Claude'
      },
      {
        title: 'Integrate AI Threat Suggestions',
        description: 'Connect AI Service to provide automated threat suggestions based on the system model. Implement UI for displaying suggestions.',
        priority: 'medium',
        status: 'todo',
        project_id: project.id,
        assigned_to: 'Claude'
      },
      {
        title: 'Implement Report Generation',
        description: 'Connect Report Service to generate PDF, HTML, and JSON reports. Add UI for report configuration and download.',
        priority: 'medium',
        status: 'todo',
        project_id: project.id,
        assigned_to: 'Claude'
      },
      {
        title: 'Add Real-time Collaboration Features',
        description: 'Implement WebSocket connections for real-time updates when multiple users are working on the same threat model.',
        priority: 'low',
        status: 'todo',
        project_id: project.id,
        assigned_to: 'Claude'
      },
      {
        title: 'Implement TMAC (Threat Modeling as Code)',
        description: 'Add support for YAML/JSON threat model definitions, Git integration, and CI/CD pipeline hooks.',
        priority: 'low',
        status: 'todo',
        project_id: project.id,
        assigned_to: 'Claude'
      },
      {
        title: 'Update Documentation',
        description: 'Update PROJECT_STATE.md, TASKS.md, and TODO.md to reflect actual implementation status and completed features.',
        priority: 'medium',
        status: 'todo',
        project_id: project.id,
        assigned_to: 'Claude'
      }
    ];

    // Create all tasks
    console.log(`\n📋 Creating ${tasks.length} tasks...`);
    
    for (const task of tasks) {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
      });
      
      if (response.ok) {
        const createdTask = await response.json();
        console.log(`✅ Created task: ${task.title}`);
      } else {
        console.error(`❌ Failed to create task: ${task.title}`, await response.text());
      }
    }
    
    console.log('\n✨ All tasks created successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTasks();