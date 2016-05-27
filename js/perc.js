$(function() {
    function csvProcessing(data) {
        inputtable.createModel(data.match(/[^\r\n]+/g).map(function(line) { return line.split(/[,\t]/g).map(function(entry) { return entry.trim(); }); }));
    };
    function readFile(e) {
        if (window.FileReader && e.files.length > 0) {
            var reader = new FileReader();
            var extension = e.files[0].name.split('.').pop().toLowerCase();
            switch (extension) {
                case "xls":
                    reader.onload = function (event) {
                        var data = XLS.read(event.target.result,{type:'binary'});
                        csvProcessing(XLS.utils.make_csv(data.Sheets[data.SheetNames[0]]));
                    };
                    reader.readAsBinaryString(e.files[0]);
                    break;
                case "xlsx":
                    reader.onload = function (event) {
                        var data = XLSX.read(event.target.result,{type:'binary'});
                        csvProcessing(XLSX.utils.make_csv(data.Sheets[data.SheetNames[0]]));
                    };
                    reader.readAsBinaryString(e.files[0]);
                    break;
                default:
                    reader.onload = function (event) {
                        csvProcessing(event.currentTarget.result);
                    };
                    reader.readAsText(e.files[0]);
                    break;
            }
            $('[href="#output"]').parent().addClass('disabled');
            $('[href="#input"]').trigger('click');
        } else {
            alert("PERC is not compatible with this browser. Please try upgrading your browser or using a different browser.");
        }
    }
    $("#inputfile").on('change',function(e) { readFile(this); });
    $("#dataset1").on('drop',function(e) {
        e.preventDefault();
        $("#inputfile").wrap('<form>').closest('form').get(0).reset();
        $("#inputfile").unwrap();
        readFile({
            "files": e.originalEvent.dataTransfer.files
        });
    });
    
    var tablenav_buttons = $(".input-tables .tablenav button");
    tablenav_buttons.eq(0).on('click',function(e) {
        e.preventDefault();
        inputtable.model.page = 0;
        inputtable.update();
    });
    tablenav_buttons.eq(1).on('click',function(e) {
        e.preventDefault();
        inputtable.model.page -= 1;
        inputtable.update();
    });
    tablenav_buttons.eq(2).on('click',function(e) {
        e.preventDefault();
        inputtable.model.page += 1;
        inputtable.update();
    });
    tablenav_buttons.eq(3).on('click',function(e) {
        e.preventDefault();
        inputtable.model.page = inputtable.model.table.length-1;
        inputtable.update();
    });
    $(".input-tables .tablenav input[type='text']").on('change',function(e) {
        e.preventDefault();
        inputtable.model.page = Math.min(e.target.value-1,inputtable.model.table.length-1);
        inputtable.update();
    });

    $.adamant.pastable.functions["table-input"] = function (target, data) {
        $("#inputfile").wrap('<form>').closest('form').get(0).reset();
        $("#inputfile").unwrap();
        try {
            csvProcessing(data.match(/[^\r\n]+/g).map(function(line) { return line.split(/[,\t]/g).map(function(entry) { return entry.trim(); }); }));
        } finally {
            $(target).children("textarea").val("");
        }
    };

    $(document).on("shown.bs.tab", function (event, ui) {
        // fix dataTable column widths on tab change
        var tables = $.fn.dataTable.fnTables(true);
        if (tables.length > 0) {
            $.each(tables, function () {
                $(this).dataTable().fnAdjustColumnSizing();
            });
        }
    });
    
    $("#modelBt").on('click', function(e) {
        window.URL.revokeObjectURL($("#filedownload").find("a").attr("href"));
        $("#filedownload").remove();
        var outputdata = calculator.calculate(inputtable.model.table);
        var target = $("#chemtable");
        if ($.fn.DataTable.isDataTable("#chemtable")) {
            target.DataTable().destroy();
        }
        var headers = [{
            data: "id",
            title: "SUBJECT"
        },{
            data: "cafestol",
            title: "Cafestol (C)"
        },{
            data: "kahweol",
            title: "Kahweol (K)"
        },{
            data: "CQA",
            title: "Caffeolyquinic acid (CQA)"
        },{
            data: "diCQA",
            title: "Dicaffeoylquinic acid (di-CQA)"
        },{
            data: "FQA",
            title: "Feruloylquinic acid (FQA)"
        },{
            data: "trigonelline",
            title: "Trigonelline (T)"
        },{
            data: "nicotinic_acid",
            title: "Nicotinic acid (NA)"
        }];
        var dTbl = target.DataTable({
            "data": outputdata,
            "columns": headers,
            "destroy": true,
            "bSort": false,
            "bFilter": false,
            "paging": false,
            "responsive": true,
            "dom": 't',
            "scrollX": false
        });
        var data = headers.map(function(entry) { return entry.title; }).join(",") + "\n";
        for (var i = 0; i < outputdata.length; i++) {
            data += headers.map(function(entry) { return outputdata[i][entry.data]; }).join(",") + "\n";
        }
        var blob = new Blob([data], { type: "text/csv;charset=UTF-8" });
        var link = $("#inputblock").append('<div id="filedownload" class="row"><div class="tabledownload col-sm-12"><a href="javascript:void(0);" id="findme">Download Dataset</a></div></div>').find("#findme");
        link = link.removeAttr("id")[0];
        link.href = window.URL.createObjectURL(blob);
        link.download = "perc-output." + Date.now() + ".csv";
        $('[href="#output"]').parent().removeClass('disabled');
        $('[href="#output"]').trigger('click');
    });

    $("#resetBt").on('click', function(e) {
        window.URL.revokeObjectURL($("#filedownload").find("a").attr("href"));
        $("#filedownload").remove();
        inputtable.reset();
        $('[href="#output"]').parent().addClass('disabled');
        $('[href="#input"]').trigger('click');
    });

    $('ul.nav').on('click','li.disabled a[data-toggle="tab"]',function(e) {
        e.preventDefault();
        return false;
    });

    inputtable.reset();
});

var inputtable = (function($,ReadFile) {
    var modelDefault = {
        id: "",
        filter_coffee: {
            caffeinated: {
                arabica: {
                    light: 0,
                    medium: 0,
                    dark: 0
                },
                unspecified: {
                    light: 0,
                    medium: 0,
                    dark: 0
                }
            },
            decaffeinated: {
                arabica: {
                    light: 0,
                    medium: 0,
                    dark: 0
                },
                unspecified: {
                    light: 0,
                    medium: 0,
                    dark: 0
                }
            }
        },
        espresso_coffee: {
            caffeinated: {
                medium: 0,
                dark: 0
            },
            decaffeinated: {
                medium: 0,
                dark: 0
            }
        },
        instant_coffee: {
            caffeinated: 0,
            decaffeinated: 0
        },
        boiled_coffee: 0
    };
    var self = {
        createModel: createModel,
        model: {},
        reset: reset,
        update: update
    };

    function createInputTable(containerID, headers, data) {
        var table = $(document.createElement('table'));
        table.attr('class', 'table display compact');
        table.attr('width', '100%');
        $(containerID).children(".dataTables_wrapper").children(".dataTable").DataTable().destroy();
        $(containerID).children("table").remove();
        $(containerID).prepend(table);
        table.DataTable({
            "destroy": true,
            "data": data,
            "columns": headers,
            "bSort": false,
            "bFilter": false,
            "paging": false,
            "responsive": true,
            "dom": 't',
            "scrollX": false
        });
        $(containerID).find('#inputTable_wrapper').addClass('table-responsive');
        $(containerID).find('.table').addClass('input-table');
        return table;
    };

    function createModel(input) {
        self.model.page = 0;
        self.model.submittable = true;
        self.model.table = [];
        var tablePage;
        for (var index in input) {
            var coffee_type, key;
            if (input[index][0] != "") {
                tablePage = $.extend(true,{},modelDefault);
                self.model.table.push(tablePage);
                tablePage.id = input[index][0];
            }
            if (input[index][1] != "") {
                key = input[index][1].toLowerCase().replace(" ","_");
                coffee_type = tablePage[key];
            }
            if (!isNaN(parseInt(input[index][5]))) {
                switch (key) {
                    case "filter_coffee":
                        var caf = coffee_type[input[index][2].toLowerCase()];
                        if (caf !== undefined) {
                            var spec = caf[input[index][4].toLowerCase()];
                            if (spec !== undefined) {
                                var roast = spec[input[index][3].toLowerCase()];
                                if (roast !== undefined) {
                                    spec[input[index][3].toLowerCase()] = parseInt(input[index][5]);
                                }
                            }
                        }
                        break;
                    case "espresso_coffee":
                        var caf = coffee_type[input[index][2].toLowerCase()];
                        if (caf !== undefined) {
                            var spec = input[index][4].toLowerCase();
                            if (spec == "arabica" || spec.length == 0) {
                                var roast = caf[input[index][3].toLowerCase()];
                                if (roast !== undefined) {
                                    caf[input[index][3].toLowerCase()] = parseInt(input[index][5]);
                                }
                            }
                        }
                        break;
                    case "instant_coffee":
                        var caf = coffee_type[input[index][2].toLowerCase()];
                        if (caf !== undefined) {
                            var spec = input[index][4].toLowerCase();
                            if (spec == "unspecified" || spec.length == 0) {
                                var roast = input[index][3].toLowerCase();
                                if (roast == "medium" || roast.length == 0) {
                                    coffee_type[input[index][2].toLowerCase()] = parseInt(input[index][5]);
                                }
                            }
                        }
                        break;
                    case "boiled_coffee":
                        var caf = input[index][2].toLowerCase();
                        if (caf == "caffeinated") {
                            var spec = input[index][4].toLowerCase();
                            if (spec == "unspecified" || spec.length == 0) {
                                var roast = input[index][3].toLowerCase();
                                if (roast == "medium" || roast.length == 0) {
                                    tablePage[key] = parseInt(input[index][5]);
                                }
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
        }
        $("#dataset1 .paste-here").remove();
        update();
    }

    function organize(page) {
        return [
            [page.id,"Filter coffee","Caffeinated","Light","Arabica",page.filter_coffee.caffeinated.arabica.light],
            ["","","Caffeinated","Medium","Arabica",page.filter_coffee.caffeinated.arabica.medium],
            ["","","Caffeinated","Dark","Arabica",page.filter_coffee.caffeinated.arabica.dark],
            ["","","Caffeinated","Light","Unspecified",page.filter_coffee.caffeinated.unspecified.light],
            ["","","Caffeinated","Medium","Unspecified",page.filter_coffee.caffeinated.unspecified.medium],
            ["","","Caffeinated","Dark","Unspecified",page.filter_coffee.caffeinated.unspecified.dark],
            ["","","Decaffeinated","Light","Arabica",page.filter_coffee.decaffeinated.arabica.light],
            ["","","Decaffeinated","Medium","Arabica",page.filter_coffee.decaffeinated.arabica.medium],
            ["","","Decaffeinated","Dark","Arabica",page.filter_coffee.decaffeinated.arabica.dark],
            ["","","Decaffeinated","Light","Unspecified",page.filter_coffee.decaffeinated.unspecified.light],
            ["","","Decaffeinated","Medium","Unspecified",page.filter_coffee.decaffeinated.unspecified.medium],
            ["","","Decaffeinated","Dark","Unspecified",page.filter_coffee.decaffeinated.unspecified.dark],
            ["","Espresso coffee","Caffeinated","Medium","Arabica",page.espresso_coffee.caffeinated.medium],
            ["","","Caffeinated","Dark","Arabica",page.espresso_coffee.caffeinated.dark],
            ["","","Decaffeinated","Medium","Arabica",page.espresso_coffee.decaffeinated.medium],
            ["","","Decaffeinated","Dark","Arabica",page.espresso_coffee.decaffeinated.dark],
            ["","Instant coffee","Caffeinated","Medium","Unspecified",page.instant_coffee.caffeinated],
            ["","","Decaffeinated","Medium","Unspecified",page.instant_coffee.decaffeinated],
            ["","Boiled coffee","Caffeinated","Medium","Unspecified",page.boiled_coffee]
        ];
    };

    function reset() {
      self.model.page = 0;
      self.model.submittable = false;
      self.model.table = [$.extend(true, {}, modelDefault, {
          id: "Sample 1",
          filter_coffee: {
              caffeinated: {
                  arabica: { light: 100 },
                  unspecified: { light: 50 }
              },
              decaffeinated: { arabica: { medium: 150 } }
          },
          espresso_coffee: { caffeinated: { medium: 100 } }
      })];
      $("#inputfile").wrap('<form>').closest('form').get(0).reset();
      $("#inputfile").unwrap();
      $("#dataset1 .paste-here").remove();
      $("#dataset1 textarea").before('<img class="img-responsive paste-here" alt="paste here" src="/common/images/paste-here.gif"/>');
      self.update()
    };

    function update() {
        createInputTable("#dataset1",["SUBJECT","Coffee type","Caffeine Type","Roast","Species","AMOUNT (g)"].map(function(entry) {
          return {title: entry};
        }),organize(self.model.table[self.model.page]));
        if (self.model.table.length > 1) {  
            var tablenav = $(".input-tables .tablenav");
            var tablenav_buttons = tablenav.find("button");
            tablenav.find("input[type='text']").val(self.model.page+1);
            tablenav.find(".page-count").html(self.model.table.length);
            tablenav_buttons.slice(0,2).attr('disabled',self.model.page == 0);
            tablenav_buttons.slice(2,4).attr('disabled',self.model.page == self.model.table.length-1);
            tablenav.addClass("show");
        } else {
            $(".input-tables .tablenav").removeClass("show");
        }        
        $("#modelBt").attr('disabled', !self.model.submittable);
    };

    return self;
}($));

var calculator = (function() {
    var constants = {
        cafestol: {
            light: 1.1,
            dark: 0.9,
            unspecified: 0.7
        },
        kahweol: {
            light: 1.1,
            dark: 0.9,
            unspecified: 0.7
        },
        CQA: {
            light: 1.1,
            dark: 0.9,
            arabica: 0.5,
            espresso: 0.6,
            instant: 0.3,
            boiled: 1.0
        },
        diCQA: {
            light: 1.1,
            dark: 0.9,
            arabica: 0.5,
            espresso: 0.6,
            instant: 0.3,
            boiled: 1
        },
        FQA: {
            light: 1.1,
            dark: 0.9,
            arabica: 0.5,
            espresso: 0.6,
            instant: 0.3,
            boiled: 1
        },
        trigonelline: {
            light: 1.1,
            dark: 0,
            unspecified: 0.8,
            decaf: 0.7,
            espresso: 1,
            instant: 0.625,
            boiled: 1.25
        },
        nicotinic_acid: {
            light: 0.9,
            dark: 1.1,
            unspecified: 0.9,
            decaf: 0.7,
            espresso: 1,
            instant: .55,
            boiled: 1.1
        }
    };
    var multiplier = {
        filter_coffee: {
            caffeinated: {
                arabica: {
                    light: {
                        cafestol: .21*constants.cafestol.light,
                        kahweol: .25*constants.kahweol.light,
                        CQA: 62.09*constants.CQA.light,
                        diCQA: 7.72*constants.diCQA.light,
                        FQA: 17.9*constants.FQA.light,
                        trigonelline: 45*constants.trigonelline.light,
                        nicotinic_acid: 10*constants.nicotinic_acid.light
                    },
                    medium: {
                        cafestol: .21,
                        kahweol: .25,
                        CQA: 62.09,
                        diCQA: 7.72,
                        FQA: 17.9,
                        trigonelline: 45,
                        nicotinic_acid: 10
                    },
                    dark: {
                        cafestol: .25*constants.cafestol.dark,
                        kahweol: .25*constants.kahweol.dark,
                        CQA: 62.09*constants.CQA.dark,
                        diCQA: 7.72*constants.diCQA.dark,
                        FQA: 17.9*constants.FQA.dark,
                        trigonelline: 45*constants.trigonelline.dark,
                        nicotinic_acid: 10*constants.nicotinic_acid.dark
                    }
                },
                unspecified: {
                    light: {
                        cafestol: .21*constants.cafestol.unspecified*constants.cafestol.light,
                        kahweol: .25*constants.cafestol.unspecified*constants.kahweol.light,
                        CQA: 181.43*constants.CQA.light,
                        diCQA: 6.26*constants.diCQA.light,
                        FQA: 24.43*constants.FQA.light,
                        trigonelline: 45*constants.trigonelline.unspecified*constants.trigonelline.light,
                        nicotinic_acid: 10*constants.nicotinic_acid.unspecified*constants.nicotinic_acid.light
                    },
                    medium: {
                        cafestol: .21*constants.cafestol.unspecified,
                        kahweol: .25*constants.kahweol.unspecified,
                        CQA: 181.43,
                        diCQA: 7.72,
                        FQA: 24.43,
                        trigonelline: 45*constants.trigonelline.unspecified,
                        nicotinic_acid: 10*constants.nicotinic_acid.unspecified
                    },
                    dark: {
                        cafestol: .21*constants.cafestol.unspecified*constants.cafestol.dark,
                        kahweol: .25*constants.cafestol.unspecified*constants.kahweol.dark,
                        CQA: 181.43*constants.CQA.dark,
                        diCQA: 7.72*constants.diCQA.dark,
                        FQA: 24.43*constants.FQA.dark,
                        trigonelline: 45*constants.trigonelline.unspecified*constants.trigonelline.dark,
                        nicotinic_acid: 10*constants.nicotinic_acid.unspecified*constants.nicotinic_acid.dark
                    }
                }
            },
            decaffeinated: {
                arabica: {
                    light: {
                        cafestol: .21*constants.cafestol.light,
                        kahweol: .25*constants.kahweol.light,
                        CQA: 235.05*constants.CQA.light*constants.CQA.arabica,
                        diCQA: 22.23*constants.diCQA.light*constants.diCQA.arabica,
                        FQA: 21.23*constants.FQA.arabica*constants.FQA.light,
                        trigonelline: 45*constants.trigonelline.decaf*constants.trigonelline.light,
                        nicotinic_acid: 10*constants.nicotinic_acid.decaf*constants.nicotinic_acid.light
                    },
                    medium: {
                        cafestol: .21,
                        kahweol: .25,
                        CQA: 235.05*constants.CQA.arabica,
                        diCQA: 22.23*constants.diCQA.arabica,
                        FQA: 21.23*constants.FQA.arabica,
                        trigonelline: 45*constants.trigonelline.decaf,
                        nicotinic_acid: 10*constants.nicotinic_acid.decaf
                    },
                    dark: {
                        cafestol: .25*constants.cafestol.dark,
                        kahweol: .25*constants.kahweol.dark,
                        CQA: 235.05*constants.CQA.dark*constants.CQA.arabica,
                        diCQA: 22.23*constants.diCQA.dark*constants.diCQA.arabica,
                        FQA: 21.23*constants.FQA.arabica*constants.FQA.dark,
                        trigonelline: 45*constants.trigonelline.decaf*constants.trigonelline.dark,
                        nicotinic_acid: 10*constants.nicotinic_acid.decaf*constants.nicotinic_acid.dark
                    }
                },
                unspecified: {
                    light: {
                        cafestol: .21*constants.cafestol.unspecified*constants.cafestol.light,
                        kahweol: .25*constants.cafestol.unspecified*constants.kahweol.light,
                        CQA: 235.05*constants.CQA.light,
                        diCQA: 22.23*constants.diCQA.light,
                        FQA: 21.23*constants.FQA.light,
                        trigonelline: 45*constants.trigonelline.decaf*constants.trigonelline.unspecified*constants.trigonelline.light,
                        nicotinic_acid: 10*constants.nicotinic_acid.decaf*constants.nicotinic_acid.unspecified*constants.nicotinic_acid.light
                    },
                    medium: {
                        cafestol: .21*constants.cafestol.unspecified,
                        kahweol: .25*constants.kahweol.unspecified,
                        CQA: 235.05,
                        diCQA: 22.23,
                        FQA: 21.23,
                        trigonelline: 45*constants.trigonelline.decaf*constants.trigonelline.unspecified,
                        nicotinic_acid: 10*constants.nicotinic_acid.decaf*constants.nicotinic_acid.unspecified
                    },
                    dark: {
                        cafestol: .21*constants.cafestol.unspecified*constants.cafestol.dark,
                        kahweol: .25*constants.cafestol.unspecified*constants.kahweol.dark,
                        CQA: 235.05*constants.CQA.dark,
                        diCQA: 22.23*constants.diCQA.dark,
                        FQA: 21.23*constants.FQA.dark,
                        trigonelline: 45*constants.trigonelline.decaf*constants.trigonelline.unspecified*constants.trigonelline.dark,
                        nicotinic_acid: 10*constants.nicotinic_acid.decaf*constants.nicotinic_acid.unspecified*constants.nicotinic_acid.dark
                    }
                }
            }
        },
        espresso_coffee: {
            caffeinated: {
                medium: {
                    cafestol: 1.7,
                    kahweol: 1.7,
                    CQA: 62.09*constants.CQA.espresso,
                    diCQA: 7.72*constants.diCQA.espresso,
                    FQA: 17.9*constants.FQA.espresso,
                    trigonelline: 45*constants.trigonelline.espresso,
                    nicotinic_acid: 10*constants.nicotinic_acid.espresso
                },
                dark: {
                    cafestol: 1.7*constants.cafestol.dark,
                    kahweol: 1.7*constants.kahweol.dark,
                    CQA: 62.09*constants.CQA.espresso*constants.CQA.dark,
                    diCQA: 7.72*constants.diCQA.espresso*constants.diCQA.dark,
                    FQA: 17.9*constants.FQA.espresso*constants.FQA.dark,
                    trigonelline: 45*constants.trigonelline.espresso*constants.trigonelline.dark,
                    nicotinic_acid: 10*constants.nicotinic_acid.espresso*constants.nicotinic_acid.dark
                }
            },
            decaffeinated: {
                medium: {
                    cafestol: 1.7,
                    kahweol: 1.7,
                    CQA: 235.05*constants.CQA.espresso*constants.CQA.arabica,
                    diCQA: 22.23*constants.diCQA.espresso*constants.diCQA.arabica,
                    FQA: 21.23*constants.FQA.espresso*constants.FQA.arabica,
                    trigonelline: 45*constants.trigonelline.espresso*constants.trigonelline.decaf,
                    nicotinic_acid: 10*constants.nicotinic_acid.espresso*constants.nicotinic_acid.decaf
                },
                dark: {
                    cafestol: 1.7*constants.cafestol.dark,
                    kahweol: 1.7*constants.kahweol.dark,
                    CQA: 235.05*constants.CQA.espresso*constants.CQA.arabica*constants.CQA.dark,
                    diCQA: 22.23*constants.diCQA.espresso*constants.diCQA.arabica*constants.diCQA.dark,
                    FQA: 21.23*constants.FQA.espresso*constants.FQA.arabica*constants.FQA.dark,
                    trigonelline: 45*constants.trigonelline.espresso*constants.trigonelline.decaf*constants.trigonelline.dark,
                    nicotinic_acid: 10*constants.nicotinic_acid.espresso*constants.nicotinic_acid.decaf*constants.nicotinic_acid.dark
                }
            }
        },
        instant_coffee: {
            caffeinated: {
                cafestol: .2,
                kahweol: .2,
                CQA: 181.43*constants.CQA.instant,
                diCQA: 6.26*constants.diCQA.instant,
                FQA: 24.43*constants.FQA.instant,
                trigonelline: 45*constants.trigonelline.instant*constants.trigonelline.unspecified,
                nicotinic_acid: 10*constants.nicotinic_acid.instant*constants.nicotinic_acid.unspecified
            },
            decaffeinated: {
                cafestol: .2*constants.cafestol.dark,
                kahweol: .2*constants.kahweol.dark,
                CQA: 235.05*constants.CQA.instant,
                diCQA: 22.23*constants.diCQA.instant,
                FQA: 21.23*constants.FQA.instant,
                trigonelline: 45*constants.trigonelline.instant*constants.trigonelline.unspecified*constants.trigonelline.decaf,
                nicotinic_acid: 10*constants.nicotinic_acid.instant*constants.nicotinic_acid.unspecified*constants.nicotinic_acid.decaf
            }
        },
        boiled_coffee: {
            cafestol: 4.8,
            kahweol: 4.8,
            CQA: 181.43*constants.CQA.boiled,
            diCQA: 6.26*constants.diCQA.boiled,
            FQA: 24.43*constants.FQA.boiled,
            trigonelline: 45*constants.trigonelline.boiled*constants.trigonelline.unspecified,
            nicotinic_acid: 10*constants.nicotinic_acid.boiled*constants.nicotinic_acid.unspecified
        }
    };    
    var outputtable;

    return {
        calculate: calculate
    };

    function calculate(inputtable) {
        outputtable = [];
        for (var index in inputtable) {
            var page = inputtable[index];
            outputtable.push({
                id: page.id,
                cafestol: 0,
                kahweol: 0,
                CQA: 0,
                diCQA: 0,
                FQA: 0,
                trigonelline: 0,
                nicotinic_acid: 0
            });
            chemAmount(page.filter_coffee.caffeinated.arabica.light,multiplier.filter_coffee.caffeinated.arabica.light);
            chemAmount(page.filter_coffee.caffeinated.arabica.medium,multiplier.filter_coffee.caffeinated.arabica.medium);
            chemAmount(page.filter_coffee.caffeinated.arabica.dark,multiplier.filter_coffee.caffeinated.arabica.dark);
            chemAmount(page.filter_coffee.caffeinated.unspecified.light,multiplier.filter_coffee.caffeinated.unspecified.light);
            chemAmount(page.filter_coffee.caffeinated.unspecified.medium,multiplier.filter_coffee.caffeinated.unspecified.medium);
            chemAmount(page.filter_coffee.caffeinated.unspecified.dark,multiplier.filter_coffee.caffeinated.unspecified.dark);
            chemAmount(page.filter_coffee.decaffeinated.arabica.light,multiplier.filter_coffee.decaffeinated.arabica.light);
            chemAmount(page.filter_coffee.decaffeinated.arabica.medium,multiplier.filter_coffee.decaffeinated.arabica.medium);
            chemAmount(page.filter_coffee.decaffeinated.arabica.dark,multiplier.filter_coffee.decaffeinated.arabica.dark);
            chemAmount(page.filter_coffee.decaffeinated.unspecified.light,multiplier.filter_coffee.decaffeinated.unspecified.light);
            chemAmount(page.filter_coffee.decaffeinated.unspecified.medium,multiplier.filter_coffee.decaffeinated.unspecified.medium);
            chemAmount(page.filter_coffee.decaffeinated.unspecified.dark,multiplier.filter_coffee.decaffeinated.unspecified.dark);
            chemAmount(page.espresso_coffee.caffeinated.medium,multiplier.espresso_coffee.caffeinated.medium);
            chemAmount(page.espresso_coffee.caffeinated.dark,multiplier.espresso_coffee.caffeinated.dark);
            chemAmount(page.espresso_coffee.decaffeinated.medium,multiplier.espresso_coffee.decaffeinated.medium);
            chemAmount(page.espresso_coffee.decaffeinated.dark,multiplier.espresso_coffee.decaffeinated.dark);
            chemAmount(page.instant_coffee.caffeinated,multiplier.instant_coffee.caffeinated);
            chemAmount(page.instant_coffee.decaffeinated,multiplier.instant_coffee.decaffeinated);
            chemAmount(page.boiled_coffee,multiplier.boiled_coffee);
        }
        outputtable.map(function(page) {
            page["cafestol"] = parseInt(page["cafestol"])/100;
            page["kahweol"] = parseInt(page["kahweol"])/100;
            page["CQA"] = parseInt(page["CQA"])/100;
            page["diCQA"] = parseInt(page["diCQA"])/100;
            page["FQA"] = parseInt(page["FQA"])/100;
            page["trigonelline"] = parseInt(page["trigonelline"])/100;
            page["nicotinic_acid"] = parseInt(page["nicotinic_acid"])/100;
        });
        return outputtable;
    };

    function chemAmount(amount,chems) {
        for (var index in chems) {
            outputtable[outputtable.length-1][index] += amount*chems[index];
        }
    };
})();