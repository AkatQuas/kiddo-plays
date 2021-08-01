describe 'database' do
  before do
    `rm -rf test_tree_node.db`
  end

  def run_script(commands)
    raw_output = nil
    IO.popen("./exe_db-tree-node test_tree_node.db", "r+") do |pipe|
      commands.each do |command|
        pipe.puts command
      end
      pipe.close_write

      # read entire output
      raw_output = pipe.gets(nil)
    end
    raw_output.split("\n")
  end

  it 'prints constants' do
    result = run_script([
      ".constants",
      ".exit"
    ])

    expect(result).to match_array([
      "db > Constants:",
      "ROW_SIZE: 293",
      "COMMON_NODE_HEADER_SIZE: 6",
      "LEAF_NODE_HEADER_SIZE: 10",
      "LEAF_NODE_CELL_SIZE: 297",
      "LEAF_NODE_SPACE_FOR_CELLS: 4086",
      "LEAF_NODE_MAX_CELLS: 13",
      "db > Bye ~",
    ])
  end

  it 'prints error when inserting 14 rows in one node' do
    script = (1..14).map do |i|
      "insert #{i} user#{i} per#{i}son@exp.com"
    end
    script << ".exit"
    result = run_script(script)
    # Table is full, since only one node is using for storage
    expect(result[-2]).to eq('db > Error: Table full.')
    expect(result[-1]).to eq('db > Bye ~')
  end

  it 'allows printing out the structure of a non-node btree' do
    script = [3, 5, 7, 6].map do |i|
      "insert #{i} user#{i} per#{i}son@exp.com"
    end
    script << ".treenode"
    script << ".exit"
    result = run_script(script)
    expect(result).to match_array([
      "db > Executed.",
      "db > Executed.",
      "db > Executed.",
      "db > Executed.",
      "db > Tree:",
      "leaf (size 4)",
      "  - 0 : 3",
      "  - 1 : 5",
      "  - 2 : 7",
      "  - 3 : 6",
      "db > Bye ~",
    ])
  end
  it 'keeps data after closing connection' do
    result1 = run_script([
      "insert 1 user1name per1son@exp.com",
      ".exit",
    ])

    expect(result1).to match_array([
      "db > Executed.",
      "db > Bye ~",
    ])
    result2 = run_script([
      "select",
      ".exit",
    ])
    expect(result2).to match_array([
      "db > (1, user1name, per1son@exp.com)",
      "Executed.",
      "db > Bye ~",
    ])
  end

  it 'inserts and retrieves a row' do
    result = run_script([
      "insert 1 user1name person1not@exp.com",
      "select",
      ".exit",
    ])
    expect(result).to match_array([
      "db > Executed.",
      "db > (1, user1name, person1not@exp.com)",
      "Executed.",
      "db > Bye ~",
    ])
  end
end
