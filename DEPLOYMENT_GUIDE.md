# How to Deploy Secuvra Portal to Vercel

Since your code is already pushed to GitHub, deploying to Vercel is very straightforward.

## Prerequisites
- A [Vercel Account](https://vercel.com/signup) (you can sign up with GitHub).
- The project pushed to GitHub: [https://github.com/dharanesh-official/secuvra-portal](https://github.com/dharanesh-official/secuvra-portal)

## Deployment Steps

1.  **Log in to Vercel**: Go to [vercel.com](https://vercel.com) and log in.
2.  **Add New Project**:
    *   Click on the **"Add New..."** button (usually top right) and select **"Project"**.
3.  **Import Git Repository**:
    *   You should see your GitHub repositories listed on the left.
    *   Find **`secuvra-portal`** and click **Import**.
4.  **Configure Project**:
    *   **Project Name**: You can leave it as `secuvra-portal` or change it.
    *   **Framework Preset**: It should automatically detect **Vite**. If not, select **Vite** from the dropdown.
    *   **Root Directory**: **IMPORTANT**: Click `Edit` next to Root Directory and select the `web` folder.
        *   This is because your React app lives inside the `web/` folder, not the root of the repo.
    *   **Build & Output Settings**: Leave these as default (`vite build` / `dist`).
    *   **Environment Variables**: Since your Firebase config is currently hardcoded in `src/firebase.js`, you do **not** need to set any environment variables right now.
5.  **Deploy**:
    *   Click **Deploy**.
    *   Vercel will clone your repo, install dependencies, build the project, and deploy it.

## Troubleshooting

-   **404 on Refresh**: If you navigate to a page like `/login` and refresh and get a 404, ensure the `web/vercel.json` file (which I just added) is present. It handles the rewrites for the Single Page Application.
-   **Build Failures**: Check the "Logs" tab in Vercel to see the error. Common errors are missing dependencies or linting errors treated as warnings.

## Updates
Whenever you push changes to your GitHub `master` branch, Vercel will automatically redeploy the new version.
