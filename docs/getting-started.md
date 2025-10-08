Welcome to Envie user guide!

Envie is a self-hostable, open-source secret manager. Envie allows you to securely store API keys, application credentials and other application secrets.

Envie is easy to integrate with any production pipeline or developer environment, working as a dropin replacement for .env files and tools like dotenv.

### 📦 Installation

Envie is available as a CLI tool on npm.

To install it globally on your machine, run:

```bash
npm install -g @envie/cli
```

### ⚙️ Basic Setup

When using Envie for the first time, run the command `envie` without arguments to bring up a setup wizard.

This wizard will help you with the initial configuration: setting up your keypair path and terminal auto complete.

Once you have run the setup wizard you can login by running:

```bash
envie login
```

Now you are ready to use Envie!
