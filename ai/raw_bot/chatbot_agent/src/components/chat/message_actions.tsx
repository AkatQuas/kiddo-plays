const MessageActions = ({
  onDelete,
  onCopy
}: {
  onDelete: () => void;
  onCopy: () => void;
}) => {
  return (
    <div>
      <button onClick={onDelete}>Delete</button>
      <button onClick={onCopy}>Copy</button>
    </div>
  );
};

export default MessageActions;
