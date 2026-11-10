-- Practice queries, run against db/seed.sql.

-- Query Exercise 1: reading from one table

-- 1a. All of Ann's posts, newest first
SELECT body, time_created
FROM posts
WHERE user_id = 1
ORDER BY time_created DESC;

-- 1b. The 3 most recent posts on the site
SELECT id, body
FROM posts
ORDER BY time_created DESC 
LIMIT 3;

-- 1c. Users who haven't written a bio
SELECT display_name
FROM users
WHERE bio IS NULL
;

-- 1d. All pending friend requests
SELECT sender_id, receiver_id
FROM friendships
WHERE status = 'pending'
;

-- Query Exercise 2: JOINs

-- 2a. Every post with its author's name, newest first
select p.body, p.time_created, u.display_name
from posts p
join users u on u.id = p.user_id
order by p.time_created desc;

-- 2b. Comments on post 1 with the commenter's name, oldest first
select c.body, u.display_name
from comments c
join users u on u.id = c.user_id
where c.post_id=1 
order by c.time_created ASC
;

-- 2c. Pending friend requests with both names
SELECT s.display_name AS sender, r.display_name AS receiver
FROM friendships f
JOIN users s ON s.id = f.sender_id
JOIN users r on r.id =f.receiver_id
WHERE f.status = 'pending';

-- Query Exercise 3: counting with GROUP BY

-- 3a. How many posts each user has written, highest first
select u.display_name, count(*) as posts_made
from posts p
join users u on u.id = p.user_id
group by u.id
order by posts_made desc;

-- 3b. Like count for every post (including 0), most-liked first
select p.body, count(l.user_id) as total_likes
from posts p
left join likes l on l.post_id=p.id
group by p.id
order by total_likes desc;

-- Query Exercise 4: the news feed

-- 4a. IDs of Ann's (user 1) accepted friends, whichever side of the request she was on
select case when sender_id=1 then  receiver_id else sender_id end as friend_id
from friendships
where (sender_id = 1 or receiver_id =1) and status='accepted';

-- 4b. Ann's news feed: her posts and her friends' posts, newest first
select p.body, p.time_created, u.display_name
from posts p
join users u on u.id = p.user_id
where p.user_id =1 
or p.user_id in (select case when sender_id=1 then  receiver_id else sender_id end as friend_id
from friendships
where (sender_id = 1 or receiver_id =1) and status='accepted')
order by p.time_created desc;

-- 4c. The complete news feed: 4b plus like and comment counts.
-- Likes use a LEFT JOIN; comments use a correlated subquery, because joining
-- both likes and comments would multiply the rows and inflate both counts.
select p.body, p.time_created, u.display_name, count (l.user_id) as likes, 
(select count (*) from comments c where c.post_id=p.id) as comments
from posts p
join users u on u.id = p.user_id
left join likes l on l.post_id=p.id
where p.user_id =1 
or p.user_id in (select case when sender_id=1 then  receiver_id else sender_id end as friend_id
from friendships
where (sender_id = 1 or receiver_id =1) and status='accepted')
group by p.id, u.id
order by p.time_created desc;
