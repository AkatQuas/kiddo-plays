describe 'database' do
  before do
    `rm -rf test_cursor.db`
  end

  def run_script(commands)
    raw_output = nil
    IO.popen("./exe_db-with-cursor test_cursor.db", "r+") do |pipe|
      commands.each do |command|
        pipe.puts command
      end
      pipe.close_write

      # read entire output
      raw_output = pipe.gets(nil)
    end
    raw_output.split("\n")
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

  it 'prints error message when table is full' do
    script = (1..1401).map do |i|
      "insert #{i} user#{i}name person#{i}@exp.com"
    end
    script << ".exit"
    result = run_script(script)
    expect(result[-2]).to eq('db > Error: Table full.')
    expect(result[-1]).to eq('db > Bye ~')
  end


end
