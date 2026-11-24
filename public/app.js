// Web front end for the Social App API.
//
// Plain JavaScript, no framework. The page (index.html) has two screens:
//   - #auth-screen: sign up and log in (shown when logged out)
//   - #app-screen:  new post, friends, feed (shown when logged in)
//
// How it is organised:
//   1. Login token helpers (localStorage, reading the user id from the JWT)
//   2. api(): one shared helper for every request (adds the token, handles errors)
//   3. One small function per API route (signup, login, getFeed, ...)
//   4. Showing things on the page (screens, messages, posts)
//   5. Event handlers (what happens when you click or submit)
//
// Safety: text from the API (post bodies, names) is only ever put on the page
// with textContent, never innerHTML, so nobody can inject HTML or scripts (XSS).

const TOKEN_KEY = 'token';   // the name we store the login token under in localStorage
const PAGE_SIZE = 10;        // posts per feed page

// The cursor for the next feed page (a post id), or null when there are no more.
let nextCursor = null;


// =====================================================================
// 1. Login token helpers
// =====================================================================

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

// A JWT has three parts separated by dots: header.payload.signature.
// The payload is JSON encoded as base64url. Anyone can read it (it is signed,
// not encrypted), so the browser can decode it to find out who is logged in.
// Our API puts { userId, iat, exp } in it.
function readTokenPayload(token) {
    try {
        const base64url = token.split('.')[1];
        // base64url uses - and _ instead of + and /, and drops the = padding.
        let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }
        return JSON.parse(atob(base64));
    } catch (err) {
        return null; // not a valid token
    }
}

// True if the token's "exp" (expiry time, in seconds) has passed.
function isTokenExpired(payload) {
    return !payload || !payload.exp || payload.exp * 1000 <= Date.now();
}


// =====================================================================
// 2. The shared request helper
// =====================================================================

// An error that remembers the HTTP status code, so callers can check for
// 403, 404, 409 and so on.
class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Sends a request to the API and returns the JSON response body
// (or null for 204 No Content).
//   method: 'GET', 'POST', 'PATCH' or 'DELETE'
//   path:   e.g. '/posts'
//   body:   an object to send as JSON (optional)
// If the response is not 2xx it throws an ApiError with the API's
// { error: "..." } message.
async function api(method, path, body) {
    const headers = {};
    const token = getToken();
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(path, {
            method: method,
            headers: headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (err) {
        throw new ApiError(0, 'Could not reach the server. Is it running?');
    }

    // 204 No Content has no body to read.
    let data = null;
    if (response.status !== 204) {
        try {
            data = await response.json();
        } catch (err) {
            data = null; // not JSON (for example an HTML error page)
        }
    }

    if (response.ok) {
        return data;
    }

    const message = (data && data.error) || ('Request failed (' + response.status + ')');

    // 401 on a logged-in request means the token is missing, wrong or expired
    // (tokens last 1 hour). Log out and ask the user to log in again.
    // (A 401 from /login just means a wrong password, so we only do this
    // when we actually sent a token.)
    if (response.status === 401 && token) {
        const expired = 'Your session has expired. Please log in again.';
        logOut(expired);
        throw new ApiError(401, expired);
    }

    throw new ApiError(response.status, message);
}


// =====================================================================
// 3. One function per API route
// =====================================================================

function signup(email, displayName, password) {
    return api('POST', '/signup', { email: email, display_name: displayName, password: password });
}

function login(email, password) {
    return api('POST', '/login', { email: email, password: password });
}

// Returns { posts: [...], nextCursor: postId or null }
function getFeed(cursor) {
    let path = '/feed?limit=' + PAGE_SIZE;
    if (cursor !== null) {
        path += '&cursor=' + encodeURIComponent(cursor);
    }
    return api('GET', path);
}

function createPost(body) {
    return api('POST', '/posts', { body: body });
}

function deletePost(postId) {
    return api('DELETE', '/posts/' + postId);
}

function likePost(postId) {
    return api('POST', '/posts/' + postId + '/likes');
}

function unlikePost(postId) {
    return api('DELETE', '/posts/' + postId + '/likes');
}

function commentOnPost(postId, body) {
    return api('POST', '/posts/' + postId + '/comments', { body: body });
}

function sendFriendRequest(receiverId) {
    return api('POST', '/friendships', { receiver_id: receiverId });
}

function acceptFriendRequest(senderId) {
    return api('PATCH', '/friendships/' + senderId, { status: 'accepted' });
}

function searchUsers(q) {
    return api('GET', '/users/search?q=' + encodeURIComponent(q));
}

function getPendingRequests() {
    return api('GET', '/friendships/pending');
}


// =====================================================================
// 4. Showing things on the page
// =====================================================================

// A shortcut for document.getElementById.
function $(id) {
    return document.getElementById(id);
}

// Shows a message in a message box. isError picks the red style.
function showMessage(element, text, isError) {
    element.textContent = text;
    element.classList.toggle('error', Boolean(isError));
    element.hidden = false;
}

function hideMessage(element) {
    element.hidden = true;
    element.textContent = '';
}

// The page-wide message at the top.
function pageMessage(text, isError) {
    showMessage($('message'), text, isError);
}

// Shows the right screen depending on whether we have a valid token.
function showScreen() {
    const token = getToken();
    const payload = token ? readTokenPayload(token) : null;

    if (!token || isTokenExpired(payload)) {
        if (token) {
            clearToken();
            pageMessage('Your session has expired. Please log in again.', true);
        }
        $('auth-screen').hidden = false;
        $('app-screen').hidden = true;
        $('user-bar').hidden = true;
        return;
    }

    $('who-am-i').textContent = 'Logged in as user #' + payload.userId;
    $('auth-screen').hidden = true;
    $('app-screen').hidden = false;
    $('user-bar').hidden = false;
    loadFeed(true);
    loadPendingRequests();
}

// Shows the friend requests waiting for you, each with an Accept button.
async function loadPendingRequests() {
    const list = $('pending-list');
    let data;
    try {
        data = await getPendingRequests();
    } catch (err) {
        pageMessage(err.message, true);
        return;
    }
    list.replaceChildren();
    $('pending-empty').hidden = data.requests.length > 0;
    for (const request of data.requests) {
        const item = document.createElement('li');
        const who = document.createElement('span');
        // textContent, never innerHTML: a display name is text typed by a user.
        who.textContent = request.display_name + ' (user #' + request.sender_id + ')';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Accept';
        button.addEventListener('click', () => acceptAndRefresh(request.sender_id));
        item.append(who, button);
        list.append(item);
    }
}

async function acceptAndRefresh(senderId) {
    try {
        await acceptFriendRequest(senderId);
        pageMessage('You are now friends with user #' + senderId + '.', false);
        loadPendingRequests();
        loadFeed(true);  // their posts are in your feed now
    } catch (err) {
        pageMessage(err.message, true);
    }
}

function logOut(message) {
    clearToken();
    $('feed').replaceChildren();
    nextCursor = null;
    showScreen();
    if (message) {
        pageMessage(message, true);
    } else {
        hideMessage($('message'));
    }
}

// "just now", "5 min ago", "3 h ago", or a date for older posts.
function formatTime(isoString) {
    const date = new Date(isoString);
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' h ago';
    return date.toLocaleString();
}

function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
}

// Builds the <li> for one post from the <template> in index.html.
// post = { id, author_id, body, time_created, display_name, likes, comments, liked_by_me }
function renderPost(post) {
    const me = readTokenPayload(getToken());
    const li = $('post-template').content.firstElementChild.cloneNode(true);
    li.dataset.postId = post.id;

    // Counts we update as the user likes and comments.
    let likes = post.likes;
    let comments = post.comments;
    // The feed tells us whether we already liked this post.
    let liked = post.liked_by_me === true;

    const likesEl = li.querySelector('.post-likes');
    const commentsEl = li.querySelector('.post-comments');
    const likeButton = li.querySelector('.like-button');
    const messageEl = li.querySelector('.post-message');

    li.querySelector('.post-author').textContent = post.display_name;
    li.querySelector('.post-body').textContent = post.body;
    const timeEl = li.querySelector('.post-time');
    timeEl.textContent = formatTime(post.time_created);
    timeEl.dateTime = post.time_created;
    timeEl.title = new Date(post.time_created).toLocaleString();

    function updateCounts() {
        likesEl.textContent = plural(likes, 'like');
        commentsEl.textContent = plural(comments, 'comment');
    }

    function updateLikeButton() {
        likeButton.textContent = liked ? 'Unlike' : 'Like';
        likeButton.classList.toggle('liked', liked);
    }

    updateCounts();
    updateLikeButton();

    // Like / Unlike
    likeButton.addEventListener('click', async () => {
        hideMessage(messageEl);
        likeButton.disabled = true;
        try {
            if (liked) {
                await unlikePost(post.id);
                likes = Math.max(0, likes - 1);
                liked = false;
            } else {
                await likePost(post.id);
                likes += 1;
                liked = true;
            }
        } catch (err) {
            if (err.status === 409) {
                // Already liked earlier: the count already includes our like.
                liked = true;
                showMessage(messageEl, 'You already liked this post.', false);
            } else if (err.status === 404 && liked) {
                // We tried to unlike, but there was no like to remove.
                liked = false;
                showMessage(messageEl, err.message, true);
            } else {
                showMessage(messageEl, err.message, true);
            }
        }
        likeButton.disabled = false;
        updateCounts();
        updateLikeButton();
    });

    // Delete: only shown on your own posts. The API still checks (403) either way.
    const deleteButton = li.querySelector('.delete-button');
    if (me && post.author_id !== undefined && post.author_id !== me.userId) {
        deleteButton.remove();
    }
    deleteButton.addEventListener('click', async () => {
        hideMessage(messageEl);
        if (!confirm('Delete this post?')) {
            return;
        }
        try {
            await deletePost(post.id);
            li.remove();
            updateEmptyMessage();
        } catch (err) {
            // e.g. 403 "you can only delete your own post"
            showMessage(messageEl, err.message, true);
        }
    });

    // Comment
    const commentForm = li.querySelector('.comment-form');
    commentForm.addEventListener('submit', async (event) => {
        event.preventDefault();  // stop the browser reloading the page
        hideMessage(messageEl);
        const input = commentForm.elements.body;
        try {
            await commentOnPost(post.id, input.value);
            comments += 1;
            updateCounts();
            input.value = '';
            showMessage(messageEl, 'Comment added.', false);
        } catch (err) {
            showMessage(messageEl, err.message, true);
        }
    });

    return li;
}

function updateEmptyMessage() {
    $('feed-empty').hidden = $('feed').children.length > 0;
}

// Loads a page of the feed. reset = true starts again from the newest posts;
// reset = false adds the next page underneath ("Load more").
async function loadFeed(reset) {
    if (reset) {
        nextCursor = null;
    }
    const button = $('load-more-button');
    button.disabled = true;
    try {
        const data = await getFeed(nextCursor);
        if (reset) {
            $('feed').replaceChildren();
        }
        for (const post of data.posts) {
            $('feed').appendChild(renderPost(post));
        }
        nextCursor = data.nextCursor;
        button.hidden = nextCursor === null;  // no more pages: hide the button
        updateEmptyMessage();
    } catch (err) {
        if (err.status !== 401) {  // 401 already logged us out with a message
            pageMessage('Could not load the feed: ' + err.message, true);
        }
    }
    button.disabled = false;
}


// =====================================================================
// 5. Event handlers
// =====================================================================

$('signup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
        const user = await signup(form.elements.email.value, form.elements.display_name.value, form.elements.password.value);
        pageMessage('Account created for ' + user.email + ' (user #' + user.id + '). You can log in now.', false);
        // Copy the email into the login form to save typing.
        $('login-form').elements.email.value = user.email;
        form.reset();
    } catch (err) {
        pageMessage(err.message, true);
    }
});

$('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
        const data = await login(form.elements.email.value, form.elements.password.value);
        saveToken(data.token);
        form.reset();
        hideMessage($('message'));
        showScreen();
    } catch (err) {
        pageMessage(err.message, true);
    }
});

$('logout-button').addEventListener('click', () => {
    logOut();
    pageMessage('You have logged out.', false);
});

// New post: live character counter. The database checks the length after
// trimming spaces, so we count the same way.
const postForm = $('post-form');
const postText = postForm.elements.body;

function updatePostCounter() {
    const length = postText.value.trim().length;
    const ok = length >= 10 && length <= 500;
    const counter = $('post-counter');
    counter.textContent = length + ' / 500' + (length > 0 && length < 10 ? ' (at least 10)' : '');
    counter.classList.toggle('bad', length > 0 && !ok);
    $('post-button').disabled = !ok;
}

postText.addEventListener('input', updatePostCounter);

postForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
        await createPost(postText.value);
        postText.value = '';
        updatePostCounter();
        pageMessage('Posted.', false);
        loadFeed(true);  // reload so the new post appears at the top
    } catch (err) {
        pageMessage(err.message, true);
    }
});

$('user-search-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const q = event.target.elements.q.value;
    let data;
    try {
        data = await searchUsers(q);
    } catch (err) {
        pageMessage(err.message, true);
        return;
    }
    const list = $('search-results');
    list.replaceChildren();
    $('search-empty').hidden = data.users.length > 0;
    for (const user of data.users) {
        const item = document.createElement('li');
        const who = document.createElement('span');
        // textContent, never innerHTML: a display name is text typed by a user.
        who.textContent = user.display_name + ' (user #' + user.id + ')';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Add friend';
        button.addEventListener('click', async () => {
            try {
                await sendFriendRequest(user.id);
                button.textContent = 'Request sent';
                button.disabled = true;
            } catch (err) {
                pageMessage(err.message, true);
            }
        });
        item.append(who, button);
        list.append(item);
    }
});

// "Load more" asks for the next page, starting after the last post we have.
$('load-more-button').addEventListener('click', () => {
    loadFeed(false);
});

// Start: show the login screen or the feed.
showScreen();
