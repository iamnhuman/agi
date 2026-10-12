/** Complete supported profile links without changing already complete URLs. */
export function completedProfileUrl(value) {
  const input=String(value).trim(),username=input.replace(/^@/,'');
  if(/^[a-zA-Z0-9._]+$/.test(username))return `https://www.instagram.com/${username}`;
  if(/^(?:r|u|user)\/[a-zA-Z0-9_-]+\/?$/i.test(input))return `https://www.reddit.com/${input}`;
  if(/^(?:(?:www\.)?(?:instagram\.com|t\.me|telegram\.me|redd\.it)|(?:(?:www|old|new|m)\.)?reddit\.com)(?=\/|[?#]|$)/i.test(input))return `https://${input}`;
  return input;
}
