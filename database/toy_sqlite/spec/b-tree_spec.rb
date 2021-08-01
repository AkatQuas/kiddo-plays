describe 'database' do
  before do
    `rm -rf test_b_tree.db`
  end

  def run_script(commands)
    raw_output = nil
    IO.popen("./exe_db-b-tree test_b_tree.db", "r+") do |pipe|
      commands.each do |command|
        begin
          pipe.puts command
        rescue Errno::EPIPE
          break
        end
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
      "LEAF_NODE_HEADER_SIZE: 14",
      "LEAF_NODE_CELL_SIZE: 297",
      "LEAF_NODE_SPACE_FOR_CELLS: 4082",
      "LEAF_NODE_MAX_CELLS: 13",
      "db > Bye ~",
    ])
  end

  it 'allows printing out the structure of a 3-leaf-node btree' do
    script = (1..14).map do |i|
      "insert #{i} user#{i} per#{i}son@exp.com"
    end
    script << ".btree"
    script << "insert 15 user15 per15son@exp.com"
    script << ".exit"

    result = run_script(script)
    expect(result[14...(result.length)]).to match_array([
      "db > Tree:",
      "- internal (size 1)",
      "  - leaf (size 7)",
      "    - 1",
      "    - 2",
      "    - 3",
      "    - 4",
      "    - 5",
      "    - 6",
      "    - 7",
      "  - key 7",
      "  - leaf (size 7)",
      "    - 8",
      "    - 9",
      "    - 10",
      "    - 11",
      "    - 12",
      "    - 13",
      "    - 14",
      "db > Executed.",
      "db > Bye ~",
    ])
  end

  it 'allows printing out the structure of a non-node btree' do
    script = [3, 5, 7, 6].map do |i|
      "insert #{i} user#{i} per#{i}son@exp.com"
    end
    script << ".btree"
    script << ".exit"
    result = run_script(script)
    expect(result).to match_array([
      "db > Executed.",
      "db > Executed.",
      "db > Executed.",
      "db > Executed.",
      "db > Tree:",
      "- leaf (size 4)",
      "  - 3",
      "  - 5",
      "  - 6",
      "  - 7",
      "db > Bye ~",
    ])
  end

  it 'prints all rows in a multi-level tree' do
    script = []
    (1..15).each do |i|
      script << "insert #{i} user#{i} per#{i}son@exp.com"
    end
    script << "select"
    script << ".exit"
    result = run_script(script)

    expect(result [15...(result.length)]).to match_array([
      "db > (1, user1, per1son@exp.com)",
      "(2, user2, per2son@exp.com)",
      "(3, user3, per3son@exp.com)",
      "(4, user4, per4son@exp.com)",
      "(5, user5, per5son@exp.com)",
      "(6, user6, per6son@exp.com)",
      "(7, user7, per7son@exp.com)",
      "(8, user8, per8son@exp.com)",
      "(9, user9, per9son@exp.com)",
      "(10, user10, per10son@exp.com)",
      "(11, user11, per11son@exp.com)",
      "(12, user12, per12son@exp.com)",
      "(13, user13, per13son@exp.com)",
      "(14, user14, per14son@exp.com)",
      "(15, user15, per15son@exp.com)",
      "Executed.",
      "db > Bye ~",
    ])
  end

  it 'allows printing out the structure of a 4-leaf-node btee' do
    script = [
      "insert 18 user18 person18@example.com",
      "insert 7 user7 person7@example.com",
      "insert 10 user10 person10@example.com",
      "insert 29 user29 person29@example.com",
      "insert 23 user23 person23@example.com",
      "insert 4 user4 person4@example.com",
      "insert 14 user14 person14@example.com",
      "insert 30 user30 person30@example.com",
      "insert 15 user15 person15@example.com",
      "insert 26 user26 person26@example.com",
      "insert 22 user22 person22@example.com",
      "insert 19 user19 person19@example.com",
      "insert 2 user2 person2@example.com",
      "insert 1 user1 person1@example.com",
      "insert 21 user21 person21@example.com",
      "insert 11 user11 person11@example.com",
      "insert 6 user6 person6@example.com",
      "insert 20 user20 person20@example.com",
      "insert 5 user5 person5@example.com",
      "insert 8 user8 person8@example.com",
      "insert 9 user9 person9@example.com",
      "insert 3 user3 person3@example.com",
      "insert 12 user12 person12@example.com",
      "insert 27 user27 person27@example.com",
      "insert 17 user17 person17@example.com",
      "insert 16 user16 person16@example.com",
      "insert 13 user13 person13@example.com",
      "insert 24 user24 person24@example.com",
      "insert 25 user25 person25@example.com",
      "insert 28 user28 person28@example.com",
      ".btree",
      ".exit",
    ]
    result = run_script(script)
    expect(result[30...(result.length)]).to match_array([
      "db > Tree:",
      "- internal (size 3)",
      "  - leaf (size 7)",
      "    - 1",
      "    - 2",
      "    - 3",
      "    - 4",
      "    - 5",
      "    - 6",
      "    - 7",
      "  - key 7",
      "  - leaf (size 8)",
      "    - 8",
      "    - 9",
      "    - 10",
      "    - 11",
      "    - 12",
      "    - 13",
      "    - 14",
      "    - 15",
      "  - key 15",
      "  - leaf (size 7)",
      "    - 16",
      "    - 17",
      "    - 18",
      "    - 19",
      "    - 20",
      "    - 21",
      "    - 22",
      "  - key 22",
      "  - leaf (size 8)",
      "    - 23",
      "    - 24",
      "    - 25",
      "    - 26",
      "    - 27",
      "    - 28",
      "    - 29",
      "    - 30",
      "db > Bye ~",
    ])
  end

  it 'prints an error message if there is a duplicate id' do
    script = [
      "insert 1 user per@exp.com",
      "insert 1 user per@exp.com",
      "select",
      ".exit"
    ]
    result = run_script(script)
    expect(result).to match_array([
      "db > Executed.",
      "db > Error: Duplicate key.",
      "db > (1, user, per@exp.com)",
      "Executed.",
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
