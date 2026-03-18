const ToolCallItem = ({
  toolName,
  status
}: {
  toolName: string;
  status: string;
}) => {
  return (
    <div>
      <span>{toolName}</span>
      <span>{status}</span>
    </div>
  );
};

export default ToolCallItem;
