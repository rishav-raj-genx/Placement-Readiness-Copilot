import os

from github import Github


def fetch_github_data(username: str) -> dict:
    token = os.getenv("GITHUB_TOKEN") or None
    github = Github(token)
    user = github.get_user(username)
    repositories = [
        {
            "name": repository.name,
            "description": repository.description,
            "language": repository.language,
            "stars": repository.stargazers_count,
            "forks": repository.forks_count,
            "is_fork": repository.fork,
        }
        for repository in user.get_repos(sort="updated")
    ]
    return {
        "username": user.login,
        "name": user.name,
        "bio": user.bio,
        "public_repos": user.public_repos,
        "followers": user.followers,
        "following": user.following,
        "repositories": repositories,
    }
