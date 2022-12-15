import { Card } from 'antd';
export default ({ node }) => {
  return (
    <Card
      style={{
        width: '300px',
        marginBottom: '10px',
      }}
    >
      <p>Details Block</p>
      <p>name: {node.name}</p>
      <p>ip: {node.ip}</p>
    </Card>
  );
};
