export function stripUserOfSensitiveData(user: any) {
  return {
    _id: user._id,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    chats: user.chats,
    settings: user.settings,
  };
}
