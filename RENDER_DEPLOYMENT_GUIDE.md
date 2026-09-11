# Render Free Web Service Deployment Guide

This guide is written for complete beginners to deploy the Idukki Roots e-commerce platform on Render at **Zero Cost**.

> **Note:** As mentioned in the README, Render's Free tier will erase database records and image uploads every time the server restarts. Use this strictly as an initial test deployment.

## Step 1: Push Code to GitHub

1. Go to [GitHub.com](https://github.com) and create a free account if you don't have one.
2. Click the **"+"** icon in the top right and select **"New repository"**.
3. Name it `idukkiroots-lite` and make it **Private**.
4. Follow the instructions on GitHub to push your local code to this repository.

## Step 2: Create a Render Account

1. Go to [Render.com](https://render.com) and click **"Get Started"**.
2. Sign up using your GitHub account.

## Step 3: Create the Web Service

1. In your Render Dashboard, click **"New"** and select **"Web Service"**.
2. Under "Connect a repository", click **"Build and deploy from a Git repository"**.
3. Connect your GitHub account and select the `idukkiroots-lite` repository.

## Step 4: Configure the Service

Fill out the configuration page exactly as follows:

- **Name:** idukkiroots-web
- **Region:** Choose whichever is closest to India (e.g., Singapore).
- **Branch:** `main` (or `master`)
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `node index.js`
- **Instance Type:** Select the **Free** tier option.

## Step 5: Environment Variables

Scroll down to the **Environment Variables** section and add the following keys and values:

1. **Key:** `NODE_ENV` | **Value:** `production`
2. **Key:** `JWT_SECRET` | **Value:** `(Enter a very long random password here, do not share it)`
3. **Key:** `FRONTEND_URL` | **Value:** `https://www.idukkiroots.in`

## Step 6: Deploy

Click the **"Create Web Service"** button at the bottom. 
Render will now download your code, install dependencies, and start the server. This may take a few minutes. 

Once you see a green "Live" badge, your application is running! You can click the `*.onrender.com` link at the top to view it.

## Step 7: Configure Custom Domain (www.idukkiroots.in)

1. In your Render dashboard for this Web Service, click on the **"Settings"** tab.
2. Scroll down to **"Custom Domains"**.
3. Click **"Add Custom Domain"**.
4. Enter `www.idukkiroots.in` and click Save.
5. Render will show you DNS records (usually a CNAME record pointing to your `*.onrender.com` URL).
6. Log in to your domain registrar (where you bought `idukkiroots.in`, e.g., GoDaddy, Hostinger).
7. Go to DNS settings and add the CNAME record provided by Render.
8. Wait for DNS to propagate (can take 5 mins to 24 hours).
9. Render will automatically issue a free SSL certificate (HTTPS) once the DNS is verified.

## Step 8: Final Testing

Once the domain is active, visit `https://www.idukkiroots.in` and ensure everything loads correctly! You can check the health of the app at `https://www.idukkiroots.in/health`.
