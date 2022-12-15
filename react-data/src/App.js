import { Tabs } from 'antd';
import './App.css';
import Communicate from './Communicate';
import SharedMemory from './SharedMemory';
import SharedMemoryForm from './SharedMemoryForm';

/**
 *  @type {import('antd').TabsProps['items']}
 */
const items = [
  { label: 'SharedMemory', key: 'item-1', children: <SharedMemory /> }, // remember to pass the key prop
  { label: 'SharedMemoryForm', key: 'item-2', children: <SharedMemoryForm /> },
  { label: 'Communicate', key: 'item-3', children: <Communicate /> },
];
function App() {
  return <Tabs tabPosition="left" items={items} />;
}

export default App;
