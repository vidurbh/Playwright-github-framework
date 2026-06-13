/**
 * GitHub API Service
 * Handles repository creation, file manipulation, branching, and PRs
 */
const GITHUB_API = 'https://api.github.com';

/**
 * Get auth headers for GitHub API calls
 */
function getHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set');
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
}

/**
 * Create a private GitHub repository
 * If the owner is an org, uses /orgs/{owner}/repos endpoint.
 * Otherwise falls back to /user/repos endpoint.
 * @param {string} name - Repository name (e.g. "acme-corp-test-suite")
 * @param {string} description - Repository description
 * @param {string} [org] - Optional org/owner. Defaults to GITHUB_OWNER env var
 * @returns {Promise<{owner: string, repo: string, cloneUrl: string}>}
 */
async function createRepo(name, description = '', org = null) {
  const owner = org || process.env.GITHUB_OWNER;
  if (!owner) {
    throw new Error('GITHUB_OWNER is not set and no org provided');
  }

  // Use org endpoint if GITHUB_OWNER_IS_ORG env flag is set, otherwise user endpoint
  const isOrg = process.env.GITHUB_OWNER_IS_ORG === 'true';
  const url = isOrg ? `${GITHUB_API}/orgs/${owner}/repos` : `${GITHUB_API}/user/repos`;

  const body = {
    name,
    description,
    private: true,
    auto_init: true,
    has_issues: true,
    has_wiki: false
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create repo: ${error}`);
  }

  const data = await response.json();
  console.log(`✅ GitHub repo created: ${data.full_name}`);

  return {
    owner: data.owner.login,
    repo: data.name,
    cloneUrl: data.clone_url,
    htmlUrl: data.html_url
  };
}

/**
 * Get the default branch name for a repo, with retry logic for newly created repos.
 * When a repo is created with auto_init: true, the initial commit takes a moment
 * to propagate. This retries up to 10 times with 2-second delays.
 * @param {string} owner
 * @param {string} repo
 * @param {number} [maxRetries=10] - Max retries for race condition on new repos
 * @returns {Promise<string>}
 */
async function getDefaultBranch(owner, repo, maxRetries = 10) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers: getHeaders() });

      if (response.ok) {
        const data = await response.json();
        return data.default_branch;
      }

      // 404 means the repo information hasn't fully propagated yet (race with auto_init)
      if (response.status === 404 && attempt < maxRetries) {
        console.log(`⏳ Waiting for repo "${owner}/${repo}" info to be available (attempt ${attempt}/${maxRetries})...`);
        await sleep(2000);
        continue;
      }

      throw new Error(`Failed to get repo info: ${await response.text()}`);
    } catch (err) {
      if (attempt < maxRetries && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        console.log(`⏳ Repo "${owner}/${repo}" not yet available (attempt ${attempt}/${maxRetries})...`);
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Exhausted retries: Failed to get default branch for ${owner}/${repo}`);
}

/**
 * Sleep helper for retry/polling
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the reference SHA for a branch, with retry logic for newly created repos.
 * When a repo is created with auto_init: true, the initial commit takes a moment
 * to propagate. This retries up to 10 times with 2-second delays.
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {number} [maxRetries=10] - Max retries for race condition on new repos
 * @returns {Promise<string>}
 */
async function getBranchSha(owner, repo, branch, maxRetries = 10) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers: getHeaders() });

      if (response.ok) {
        const data = await response.json();
        return data.object.sha;
      }

      // 404 means the branch ref hasn't propagated yet (race with auto_init)
      if (response.status === 404 && attempt < maxRetries) {
        console.log(`⏳ Waiting for branch "${branch}" to be available (attempt ${attempt}/${maxRetries})...`);
        await sleep(2000);
        continue;
      }

      throw new Error(`Failed to get branch ref: ${await response.text()}`);
    } catch (err) {
      if (attempt < maxRetries && err.message.toLowerCase().includes('not found')) {
        console.log(`⏳ Branch "${branch}" not yet available (attempt ${attempt}/${maxRetries})...`);
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Exhausted retries: Failed to get branch ref for ${owner}/${repo}/${branch}`);
}

/**
 * Create a new branch from a base branch
 * @param {string} owner
 * @param {string} repo
 * @param {string} newBranch - Name of the new branch
 * @param {string} [baseBranch] - Base branch (default: main)
 * @returns {Promise<string>} The ref path
 */
async function createBranch(owner, repo, newBranch, baseBranch = 'main') {
  // Get the SHA of the base branch (with retry for auto_init race condition)
  const sha = await getBranchSha(owner, repo, baseBranch);

  const url = `${GITHUB_API}/repos/${owner}/${repo}/git/refs`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      ref: `refs/heads/${newBranch}`,
      sha
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create branch: ${error}`);
  }

  const data = await response.json();
  console.log(`✅ Branch created: ${newBranch} (ref: ${data.ref})`);
  return data.ref;
}

/**
 * Create or update a file in a repository
 * @param {string} owner
 * @param {string} repo
 * @param {string} path - File path in repo
 * @param {string} content - File content
 * @param {string} message - Commit message
 * @param {string} branch - Branch to commit to
 * @returns {Promise<object>}
 */
async function createOrUpdateFile(owner, repo, path, content, message, branch) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;

  // Encode content to base64
  const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

  const body = {
    message,
    content: contentBase64,
    branch
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create file ${path}: ${error}`);
  }

  const data = await response.json();
  console.log(`✅ File created: ${path}`);
  return data;
}

/**
 * Create a pull request
 * @param {string} owner
 * @param {string} repo
 * @param {string} title - PR title
 * @param {string} body - PR body/description
 * @param {string} head - Head branch (feature branch)
 * @param {string} base - Base branch (usually main)
 * @returns {Promise<object>}
 */
async function createPullRequest(owner, repo, title, body, head, base = 'main') {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      title,
      body,
      head,
      base,
      maintainer_can_modify: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PR: ${error}`);
  }

  const data = await response.json();
  console.log(`✅ PR created: #${data.number} - ${data.html_url}`);
  return {
    number: data.number,
    url: data.html_url,
    title: data.title
  };
}

module.exports = {
  createRepo,
  createBranch,
  createOrUpdateFile,
  createPullRequest,
  getDefaultBranch,
  getBranchSha
};